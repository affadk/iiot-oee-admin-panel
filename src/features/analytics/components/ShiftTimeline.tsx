import React, { useMemo } from 'react';
import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent, MachineFsmState } from '../../../types/monitoring';
import { Button } from '../../../components/ui/Button';
import { formatJakartaTime } from '../../../utils/historicalExport';
import { formatShiftScopeLabel, joinScopeLabel } from '../scopeLabels';
import { buildTimelineAxisTicks } from '../timelineAxis';
import { segmentProvisionalFlags } from '../timelineProvisional';
import { ShiftTimelineDetail } from './ShiftTimelineDetail';
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
  /** Ringkasan shift aktif — sumber label shift + tz (window/tz dari data summary). */
  summary: ShiftSummary | null;
  /**
   * E12 T12.12 (X-5 / FAT-58): data hourly halaman OEE — sumber penurunan
   * flag provisional segmen (gap G12). Segmen TIDAK punya field
   * `provisional` di tipe/kontrak, jadi penanda diturunkan dari jam bucket
   * hourly yang provisional (lihat `timelineProvisional`).
   */
  hourly?: HourlyOeePoint[];
  /** E12 T12.5 (U-2): sedang memuat dan belum ada segmen — tampilkan skeleton. */
  isLoading?: boolean;
  /** E12 T12.5 (U-2): query gagal dan tidak ada segmen — tampilkan pesan error. */
  isError?: boolean;
  /**
   * E12 T12.13 (X-6 / FAT-63): hitungan overlay downtime — jumlah event
   * histori yang sudah dimuat (N), total dari server bila ada (M, `null`
   * bila server tidak mengirim total), dan apakah masih ada halaman berikut.
   * Diteruskan ke `ShiftTimelineDetail` untuk "menampilkan N dari M" +
   * tombol "Muat lebih banyak" (gap G18).
   */
  downtimeLoadedCount?: number;
  downtimeTotalCount?: number | null;
  downtimeHasMore?: boolean;
  downtimeIsLoading?: boolean;
  onLoadMoreDowntime?: () => void;
  isLoadingMoreDowntime?: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
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
  summary,
  hourly = [],
  isLoading = false,
  isError = false,
  onRetry,
  downtimeLoadedCount = 0,
  downtimeTotalCount = null,
  downtimeHasMore = false,
  downtimeIsLoading = false,
  onLoadMoreDowntime,
  isLoadingMoreDowntime = false,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit — shift + tz dari data summary
  // (window shift_start/shift_end + tz) + bucket yang dipilih. Bila summary
  // belum ada (memuat/gagal), hanya bucket yang ditampilkan — tanpa tebakan shift.
  const scopeLabel = joinScopeLabel(formatShiftScopeLabel(summary), `bucket ${timelineBucket}`);
  // E12 T12.11 (X-4 / FAT-59): sumbu waktu dari start/end segmen dalam
  // Asia/Jakarta — timeline bisa dibaca jamnya tanpa membuka tooltip.
  // Tanggal jangkar = tanggal kalender shift_start summary (Jakarta);
  // tanpa summary, segmen 'HH:MM' lama tetap berlabel jam saja.
  const anchorDate = summary?.shift_start?.slice(0, 10) ?? null;
  const axis = buildTimelineAxisTicks(timeline, anchorDate);
  // E12 T12.12 (X-5 / FAT-58): flag provisional per segmen, diturunkan
  // dari jam hourly yang provisional — pola penanda sama dengan
  // Hourly/Rollup/Aggregate: teks "(Provisional)" amber.
  const provisionalFlags = useMemo(
    () => segmentProvisionalFlags(timeline, hourly, anchorDate),
    [timeline, hourly, anchorDate]
  );
  const anyProvisional = provisionalFlags.some(Boolean);
  const activeSegmentProvisional =
    activeSegmentIdx !== null ? provisionalFlags[activeSegmentIdx] ?? false : false;
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Timeline Status Mesin Shift
          </h2>
          {scopeLabel && (
            <p className="text-[11px] text-slate-500">{scopeLabel}</p>
          )}
        </div>
        <span className="text-[11px] text-slate-500">
          Klik segmen downtime (kuning/merah) untuk melihat korelasi penyebab henti mesin. Interval 1m berlaku maks 6 jam.
        </span>
      </div>

      {/* E12 T12.5 (U-2): timeline kosong bukan lagi bar kosong tanpa
          pesan (gap G17, Guide §5) — bedakan memuat / gagal / tidak ada
          data pada rentang ini. Fallback totalTimelineMin 480 hanya
          dipakai bila segmen ada. */}
      {isLoading ? (
        <div
          aria-busy="true"
          aria-label="Memuat timeline"
          className="w-full h-9 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
        >
          <span className="sr-only">Memuat timeline…</span>
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="w-full rounded border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Gagal memuat timeline
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terjadi kesalahan saat memuat timeline status mesin. Coba lagi atau periksa koneksi.
            </p>
          </div>
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
              Coba lagi
            </Button>
          )}
        </div>
      ) : timeline.length === 0 ? (
        <div className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-center space-y-0.5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tidak ada data timeline pada rentang ini
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Belum ada segmen status mesin untuk mesin dan periode yang dipilih.
          </p>
        </div>
      ) : (
        <>
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

          {/* E12 T12.11 (X-4 / FAT-59): sumbu waktu Asia/Jakarta di bawah
              bar — tick dari start/end segmen; tick yang jatuh keesokan
              harinya membawa tanggalnya ("00:00 · 17 Nov"). */}
          {axis.ticks.length > 0 && (
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
          )}
          {/* E12 T12.12 (X-5 / FAT-58): keterangan penanda provisional —
              teks "(Provisional)" yang sama dengan Hourly/Rollup/Aggregate. */}
          {anyProvisional && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 ring-1 ring-white/70 align-middle"
              />{' '}
              Segmen bertitik amber berada pada jam (Provisional) — datanya dapat berubah setelah rekonsiliasi.
            </p>
          )}
        </>
      )}

      {/* 6 Canonical Legend Items */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
        {(Object.keys(FSM_SEGMENT_COLORS) as MachineFsmState[]).map((st) => (
          <div key={st} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-xs ${FSM_SEGMENT_COLORS[st]}`} />
            <span className="font-tabular">{st}</span>
          </div>
        ))}
      </div>

      {/* Interactive Downtime Overlay Panel — rincian segmen aktif
          (komponen sendiri, pola R9.2). */}
      {activeSegment && (
        <ShiftTimelineDetail
          activeSegment={activeSegment}
          matchedDowntime={matchedDowntime}
          resolvedDeviceId={resolvedDeviceId}
          isProvisional={activeSegmentProvisional}
          downtimeLoadedCount={downtimeLoadedCount}
          downtimeTotalCount={downtimeTotalCount}
          downtimeHasMore={downtimeHasMore}
          downtimeIsLoading={downtimeIsLoading}
          onLoadMoreDowntime={onLoadMoreDowntime}
          isLoadingMoreDowntime={isLoadingMoreDowntime}
        />
      )}
    </div>
  );
};
