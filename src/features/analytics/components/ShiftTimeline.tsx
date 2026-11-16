import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent, MachineFsmState } from '../../../types/monitoring';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { Badge } from '../../../components/ui/Badge';
import { mapDowntimeToSixBigLoss } from '../../../utils/historicalExport';
import { formatDuration } from '../../../utils/oeeCalculations';
import { TimelineBucket } from '../hooks/useOeeAnalytics';

const FSM_SEGMENT_COLORS: Record<MachineFsmState, string> = {
  RUNNING: 'bg-emerald-500',
  READY: 'bg-sky-500',
  UNCONFIGURED: 'bg-slate-400',
  PLANNED_DOWNTIME: 'bg-amber-400',
  UNPLANNED_DOWNTIME: 'bg-red-500',
  BATCH_FINISHED: 'bg-indigo-500',
};

interface ShiftTimelineProps {
  timeline: ShiftTimelineSegment[];
  timelineBucket: TimelineBucket;
  totalTimelineMin: number;
  activeSegmentIdx: number | null;
  onSelectSegment: (idx: number) => void;
  activeSegment: ShiftTimelineSegment | null;
  matchedDowntime: DowntimeEvent | null;
  resolvedDeviceId: string;
}

export const ShiftTimeline: React.FC<ShiftTimelineProps> = ({
  timeline,
  timelineBucket,
  totalTimelineMin,
  activeSegmentIdx,
  onSelectSegment,
  activeSegment,
  matchedDowntime,
  resolvedDeviceId,
}) => {
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Timeline Status Mesin Shift (Bucket {timelineBucket})
        </h2>
        <span className="text-[11px] text-slate-500">
          Klik segmen downtime (kuning/merah) untuk melihat korelasi penyebab henti mesin. Interval 1m berlaku maks 6 jam.
        </span>
      </div>

      <div className="w-full h-9 rounded overflow-hidden flex border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
        {timeline.map((seg, idx) => {
          const pct = Math.max(1.5, (seg.duration_min / totalTimelineMin) * 100);
          const hasDowntime = Boolean(seg.downtime_id);
          const isSelected = activeSegmentIdx === idx;
          return (
            <button
              key={`${seg.start}-${idx}`}
              type="button"
              onClick={() => onSelectSegment(idx)}
              style={{ width: `${pct}%` }}
              title={`${seg.start}–${seg.end}: ${seg.fsm_state} (${seg.duration_min} min)${seg.downtime_id ? ` · ${seg.downtime_id}` : ''}`}
              className={`${FSM_SEGMENT_COLORS[seg.fsm_state] ?? 'bg-slate-400'} relative h-full border-r border-white/30 last:border-r-0 transition-opacity hover:opacity-90 cursor-pointer focus:outline-none ${
                isSelected ? 'ring-2 ring-inset ring-slate-950 dark:ring-white' : ''
              }`}
            >
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

      {/* 6 Canonical Legend Items */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
        {(Object.keys(FSM_SEGMENT_COLORS) as MachineFsmState[]).map((st) => (
          <div key={st} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-xs ${FSM_SEGMENT_COLORS[st]}`} />
            <span className="font-tabular">{st}</span>
          </div>
        ))}
      </div>

      {/* Interactive Downtime Overlay Panel */}
      {activeSegment && (
        <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-tabular font-semibold text-slate-900 dark:text-slate-100">
                Segmen {activeSegment.start} – {activeSegment.end} ({activeSegment.duration_min} menit)
              </span>
              <MachineStateBadge state={activeSegment.fsm_state} />
              {activeSegment.planned && <Badge variant="warning">Planned</Badge>}
            </div>
            {activeSegment.downtime_id ? (
              matchedDowntime ? (
                <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-semibold">
                      {mapDowntimeToSixBigLoss(matchedDowntime.category).label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{matchedDowntime.reason}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-tabular">
                    ID: {matchedDowntime.id} · Durasi:{' '}
                    {matchedDowntime.durationFormatted || formatDuration(matchedDowntime.duration_seconds)} ·{' '}
                    {matchedDowntime.is_labeled ? 'Sudah dilabeli' : 'Belum dilabeli'}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 font-tabular">
                  Overlay Downtime ID: {activeSegment.downtime_id} (sedang memuat rincian atau di luar rentang filter).
                </p>
              )
            ) : (
              <p className="text-slate-500">
                Segmen operasi normal tanpa insiden downtime terikat.
              </p>
            )}
          </div>

          {activeSegment.downtime_id && (
            <Link
              to={`/downtime?device_id=${encodeURIComponent(resolvedDeviceId)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <span>Buka Log Downtime</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
