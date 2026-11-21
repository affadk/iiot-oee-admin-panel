import { HourlyOeePoint, ShiftTimelineSegment } from '../../types/analytics';
import { dateKeyInJakarta } from '../../utils/historicalExport';
import { timelineBoundaryMs } from './timelineAxis';

/**
 * E12 T12.12 (X-5 / FAT-58): penanda provisional untuk segmen timeline
 * (gap G12) — logika murni, tanpa render.
 *
 * Tipe `ShiftTimelineSegment` TIDAK punya field `provisional` (dan contoh
 * respons API doc §Q.3 juga tidak memuatnya), jadi flag TIDAK ditambahkan
 * ke tipe/kontrak. Sebagai gantinya segmen ditandai provisional bila
 * bersinggungan dengan jam bucket hourly yang masih provisional — dari
 * data hourly yang sudah dimuat halaman OEE (`useOeeAnalytics` memuat
 * hourly + timeline untuk periode yang sama).
 *
 * Format waktu dicampur: segmen timeline ISO 8601 (demo sejak T12.11 +
 * Real), sedangkan `hour` hourly 'HH:MM' (demo) atau ISO (Real). Keduanya
 * diparse lewat `timelineBoundaryMs` yang sama dengan sumbu waktu, lalu
 * dibuat monoton naik (+24 jam bila mundur — segmen/bucket lintas tengah
 * malam) supaya perbandingan tumpang-tindih benar di semua kombinasi.
 * Asumsi: segmen dan hourly terurut menaik menurut waktu (kontrak respons
 * server/demo — sama seperti asumsi `buildTimelineAxisTicks`).
 *
 * Tumpang-tindih memakai interval setengah-terbuka [start, end): segmen
 * yang berakhir tepat di awal jam provisional (mis. 12:00–13:00 terhadap
 * jam 13:00) TIDAK ditandai — jamnya belum dimulai saat segmen berakhir.
 */

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

interface TimeRange {
  start: number;
  end: number;
}

/**
 * Tanggal jangkar fallback bila summary belum ada (`anchorDate` null):
 * tanggal kalender Jakarta dari segmen ISO pertama. Tanpa jangkar,
 * 'HH:MM' hourly vs segmen ISO tidak bisa dibandingkan (frame berbeda)
 * dan tidak ada segmen yang ditandai — lebih aman daripada menebak.
 */
function anchorFromSegments(segments: ShiftTimelineSegment[]): string | null {
  for (const seg of segments) {
    const ms = Date.parse(seg.start);
    if (Number.isFinite(ms)) return dateKeyInJakarta(ms);
  }
  return null;
}

/**
 * Jam mulai tiap bucket hourly (monoton naik), beserta flag-nya. Bucket
 * yang tidak bisa diparse dilewati — bukan ditebak.
 */
function adjustedHourStarts(
  hourly: HourlyOeePoint[],
  anchorDate: string | null
): Array<{ ms: number; provisional: boolean }> {
  const out: Array<{ ms: number; provisional: boolean }> = [];
  let prev: number | null = null;
  for (const pt of hourly) {
    let ms = timelineBoundaryMs(pt.hour || pt.bucket || '', anchorDate);
    if (ms === null) continue;
    if (prev !== null) {
      while (ms < prev) ms += DAY_MS;
    }
    out.push({ ms, provisional: pt.provisional === true });
    prev = ms;
  }
  return out;
}

/** Rentang tiap segmen (monoton naik) — null bila batasnya tak terparse. */
function adjustedSegmentRanges(
  segments: ShiftTimelineSegment[],
  anchorDate: string | null
): Array<TimeRange | null> {
  const ranges: Array<TimeRange | null> = [];
  let prevEnd: number | null = null;
  for (const seg of segments) {
    let start = timelineBoundaryMs(seg.start, anchorDate);
    let end = timelineBoundaryMs(seg.end, anchorDate);
    if (start === null || end === null) {
      ranges.push(null);
      continue;
    }
    // 'HH:MM' yang melewati tengah malam (end < start) membungkus +24 jam.
    while (end < start) end += DAY_MS;
    // Segmen sesudah tengah malam tidak boleh jatuh sebelum akhir segmen
    // sebelumnya — pola yang sama dengan sumbu waktu (`timelineAxis`).
    if (prevEnd !== null) {
      while (start < prevEnd) {
        start += DAY_MS;
        end += DAY_MS;
      }
    }
    ranges.push({ start, end });
    prevEnd = end;
  }
  return ranges;
}

/**
 * Satu flag per segmen (sejajar indeks `segments`): true bila segmen
 * bersinggungan dengan sedikitnya satu jam bucket hourly yang
 * `provisional`. `[]` bila tidak ada segmen; semua false bila tidak ada
 * jam provisional (atau hourly kosong / tak terparse).
 */
export function segmentProvisionalFlags(
  segments: ShiftTimelineSegment[],
  hourly: HourlyOeePoint[],
  anchorDate: string | null
): boolean[] {
  if (segments.length === 0) return [];
  const anchor = anchorDate ?? anchorFromSegments(segments);
  const provisionalHours = adjustedHourStarts(hourly, anchor).filter((h) => h.provisional);
  if (provisionalHours.length === 0) return segments.map(() => false);
  const ranges = adjustedSegmentRanges(segments, anchor);
  return ranges.map((range) => {
    if (!range) return false;
    return provisionalHours.some((h) => range.start < h.ms + HOUR_MS && range.end > h.ms);
  });
}
