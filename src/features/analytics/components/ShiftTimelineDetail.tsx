import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent } from '../../../types/monitoring';
import { Button } from '../../../components/ui/Button';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { Badge } from '../../../components/ui/Badge';
import { mapDowntimeToSixBigLoss } from '../../../utils/historicalExport';
import { formatJakartaTime } from '../../../utils/historicalExport';
import { formatDuration } from '../../../utils/oeeCalculations';
import { segmentDateNote } from '../timelineAxis';

interface ShiftTimelineDetailProps {
  activeSegment: ShiftTimelineSegment;
  matchedDowntime: DowntimeEvent | null;
  resolvedDeviceId: string;
  /**
   * E12 T12.12 (X-5 / FAT-58): segmen aktif berada di jam yang masih
   * provisional — diturunkan dari data hourly halaman OEE (lihat
   * `timelineProvisional`), bukan dari field segmen.
   */
  isProvisional: boolean;
  /**
   * E12 T12.13 (X-6 / FAT-63): hitungan overlay downtime (gap G18) —
   * jumlah event histori yang sudah dimuat (N) dan total dari server bila
   * ada (M; `null` bila server tidak mengirim `meta.count` — total tidak
   * dikarang, hanya "menampilkan N" + tombol muat lebih banyak).
   */
  downtimeLoadedCount: number;
  downtimeTotalCount: number | null;
  /** Masih ada halaman riwayat berikut yang bisa dimuat. */
  downtimeHasMore: boolean;
  /** Halaman pertama riwayat masih dimuat (korelasi belum bisa diputuskan). */
  downtimeIsLoading?: boolean;
  /** Muat halaman riwayat berikutnya (cursor). */
  onLoadMoreDowntime?: () => void;
  /** Halaman berikutnya sedang dimuat. */
  isLoadingMoreDowntime?: boolean;
}

/**
 * Panel rincian segmen timeline yang aktif (dipisah dari `ShiftTimeline`
 * mengikuti pola R9.2 — satu komponen = satu concern). Menampilkan jam +
 * state segmen, korelasi downtime bila ada, tautan ke log downtime, dan
 * penanda "(Provisional)" yang sama dengan Hourly/Rollup/Aggregate bila
 * segmen berada di jam provisional.
 *
 * E12 T12.13 (X-6 / FAT-63): footer panel menampilkan "menampilkan N dari
 * M event downtime" (+ tombol "Muat lebih banyak" selama masih ada halaman
 * berikut). Bila `downtime_id` segmen tidak ditemukan di halaman yang sudah
 * dimuat, pesannya eksplisit — "di antara N event yang dimuat, kemungkinan
 * di halaman berikutnya" (dengan aksi muat lebih banyak) atau, bila semua
 * halaman sudah dimuat, "tidak ditemukan ... pada rentang filter ini" —
 * bukan lagi pesan ambigu "sedang memuat rincian atau di luar rentang filter".
 */
export const ShiftTimelineDetail: React.FC<ShiftTimelineDetailProps> = ({
  activeSegment,
  matchedDowntime,
  resolvedDeviceId,
  isProvisional,
  downtimeLoadedCount,
  downtimeTotalCount,
  downtimeHasMore,
  downtimeIsLoading = false,
  onLoadMoreDowntime,
  isLoadingMoreDowntime = false,
}) => {
  // Tombol "Muat lebih banyak" hanya tampil sekali: di pesan tidak-ditemukan
  // bila itu yang sedang terjadi, selebihnya di footer hitungan.
  const showInlineLoadMore =
    Boolean(activeSegment.downtime_id) && !matchedDowntime && downtimeHasMore && !downtimeIsLoading;
  return (
    <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-tabular font-semibold text-slate-900 dark:text-slate-100">
              Segmen {formatJakartaTime(activeSegment.start)} – {formatJakartaTime(activeSegment.end)} ({activeSegment.duration_min} menit)
              {segmentDateNote(activeSegment) ? ` · ${segmentDateNote(activeSegment)}` : ''}
            </span>
            <MachineStateBadge state={activeSegment.fsm_state} />
            {activeSegment.planned && <Badge variant="warning">Planned</Badge>}
            {/* E12 T12.12 (X-5 / FAT-58): penanda "(Provisional)" yang sama
                dengan Hourly/Rollup/Aggregate. */}
            {isProvisional && (
              <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                (Provisional)
              </span>
            )}
          </div>
          {isProvisional && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Segmen ini berada pada jam yang masih provisional — datanya dapat berubah setelah rekonsiliasi.
            </p>
          )}
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
            ) : downtimeIsLoading ? (
              <p className="text-slate-500 font-tabular">
                Memuat rincian downtime…
              </p>
            ) : downtimeHasMore ? (
              <div className="space-y-1.5">
                <p className="text-slate-500 font-tabular">
                  Downtime ID: {activeSegment.downtime_id} tidak ditemukan di antara{' '}
                  {downtimeLoadedCount} event downtime yang sudah dimuat — kemungkinan berada di halaman berikutnya.
                </p>
                {onLoadMoreDowntime && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onLoadMoreDowntime}
                    isLoading={isLoadingMoreDowntime}
                  >
                    Muat lebih banyak
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-slate-500 font-tabular">
                Downtime ID: {activeSegment.downtime_id} tidak ditemukan di antara{' '}
                {downtimeLoadedCount} event downtime pada rentang filter ini.
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

      {/* E12 T12.13 (X-6 / FAT-63): hitungan overlay — "menampilkan N dari
          M" bila total diketahui; bila server tidak mengirim total, hanya
          "menampilkan N" (total tidak dikarang) + tombol muat lebih banyak
          selama masih ada halaman berikut. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-tabular">
          {downtimeTotalCount !== null
            ? `Menampilkan ${downtimeLoadedCount} dari ${downtimeTotalCount} event downtime`
            : `Menampilkan ${downtimeLoadedCount} event downtime`}
        </span>
        {downtimeHasMore && !showInlineLoadMore && onLoadMoreDowntime && (
          <Button
            size="sm"
            variant="outline"
            onClick={onLoadMoreDowntime}
            isLoading={isLoadingMoreDowntime}
          >
            Muat lebih banyak
          </Button>
        )}
      </div>
    </div>
  );
};
