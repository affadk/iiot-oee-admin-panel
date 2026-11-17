import { ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent } from '../../../types/monitoring';

export interface ActiveTimelineSegment {
  activeSegmentIdx: number | null;
  activeSegment: ShiftTimelineSegment | null;
  matchedDowntime: DowntimeEvent | null;
}

/**
 * E12 T12.10 (X-3 / FAT-57): seleksi segmen timeline sebagai fungsi murni
 * — dipindah dari `useOeeAnalytics` (hook itu melewati batas keras 250
 * baris setelah penambahan scope rollup) mengikuti pola R9.2 / `oeeQueryKeys`:
 * satu file per domain, logika murni yang bisa diuji tanpa render hook.
 *
 * Aturan seleksi (tidak berubah dari `useOeeAnalytics` sebelumnya):
 * pilihan pengguna yang masih valid menang; bila tidak ada pilihan (atau
 * indeksnya basi — mis. setelah ganti bucket/mesin), pakai segmen downtime
 * pertama; bila tidak ada segmen downtime sama sekali, tidak ada yang aktif.
 * `matchedDowntime` dicocokkan dari peta overlay lewat `downtime_id`
 * segmen aktif (aktif menang atas histori — dedup sudah di hook).
 */
export function resolveActiveTimelineSegment(
  timeline: ShiftTimelineSegment[],
  selectedSegmentIdx: number | null,
  downtimeMap: Map<string, DowntimeEvent>
): ActiveTimelineSegment {
  const downtimeSegments = timeline
    .map((seg, idx) => ({ seg, idx }))
    .filter(({ seg }) => Boolean(seg.downtime_id));

  const activeSegmentIdx =
    selectedSegmentIdx !== null && timeline[selectedSegmentIdx]
      ? selectedSegmentIdx
      : (downtimeSegments[0]?.idx ?? null);
  const activeSegment = activeSegmentIdx !== null ? timeline[activeSegmentIdx] : null;
  const matchedDowntime = activeSegment?.downtime_id
    ? downtimeMap.get(activeSegment.downtime_id) ?? null
    : null;

  return { activeSegmentIdx, activeSegment, matchedDowntime };
}
