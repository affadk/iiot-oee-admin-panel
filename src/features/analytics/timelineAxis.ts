import { ShiftTimelineSegment } from '../../types/analytics';
import {
  PLANT_TIME_ZONE,
  PLANT_TIME_ZONE_OFFSET,
  dateKeyInJakarta,
  formatJakartaDateShort,
  formatJakartaTime,
  parseSegmentClockMinutes,
} from '../../utils/historicalExport';

/**
 * E12 T12.11 (X-4 / FAT-59): sumbu/label jam timeline — logika murni,
 * tanpa render. Timeline sebelumnya tidak punya label sumbu waktu sama
 * sekali (gap G11): jam segmen hanya ada di tooltip/overlay.
 *
 * Tick dihitung dari batas-batas segmen (`start`/`end`) dalam
 * Asia/Jakarta, dengan langkah yang dibulatkan ke jam-dinding (60/30/15/
 * 10/5/1 mnt — maks ~9 tick) dan penanda tanggal bila sumbu melewati
 * tengah malam (mis. tick `00:00 · 17 Nov`). Menerima `start`/`end`
 * ISO 8601 (Real/demo baru) maupun 'HH:MM' polos (format demo lama):
 * 'HH:MM' dijangkarkan ke tanggal `shift_start` summary bila ada.
 */

export interface TimelineAxisTick {
  /** Instant tick (ms epoch) — dipakai untuk posisi + label tanggal. */
  ms: number;
  /** Label tick, mis. "09:00" atau "00:00 · 17 Nov" (ganti hari). */
  label: string;
  /** Posisi persen sepanjang sumbu (0–100). */
  pct: number;
}

export interface TimelineAxis {
  ticks: TimelineAxisTick[];
  /** Selalu `Asia/Jakarta` — label zona waktu yang ditampilkan di sumbu. */
  timeZoneLabel: string;
}

const NICE_STEPS_MIN = [1, 5, 10, 15, 30, 60, 120];

/** 'HH:MM' dari menit absolut (0–1439). */
function minutesToClock(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Instant (ms) sebuah batas segmen. ISO diparse apa adanya; 'HH:MM'
 * dijangkarkan ke `anchorDate` (tanggal kalender Jakarta). Batas yang
 * mundur terhadap batas sebelumnya (segmen lintas tengah malam dalam
 * format 'HH:MM', mis. end 01:00 setelah start 23:00) digeser +24 jam
 * oleh pemanggil — fungsi ini hanya mengembalikan instant mentahnya.
 *
 * Diekspor untuk `timelineProvisional` (E12 T12.12): jam bucket hourly
 * ('HH:MM' demo / ISO Real) diparse dengan aturan yang sama seperti
 * batas segmen, supaya penurunan provisional konsisten.
 */
export function timelineBoundaryMs(value: string, anchorDate: string | null): number | null {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  const clockMin = parseSegmentClockMinutes(value);
  if (clockMin === null) return null;
  if (!anchorDate) return clockMin * 60_000;
  const ms = Date.parse(`${anchorDate}T${minutesToClock(clockMin)}:00${PLANT_TIME_ZONE_OFFSET}`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Bangun tick sumbu dari segmen + tanggal jangkar (tanggal kalender
 * `shift_start` summary, 'YYYY-MM-DD', atau null bila tidak diketahui).
 * `[]` bila tidak ada segmen / tidak ada batas yang bisa diparse.
 */
export function buildTimelineAxisTicks(
  segments: ShiftTimelineSegment[],
  anchorDate: string | null
): TimelineAxis {
  const timeZoneLabel = PLANT_TIME_ZONE;
  if (segments.length === 0) return { ticks: [], timeZoneLabel };
  // Batas-batas segmen berurutan (start tiap segmen + end segmen terakhir),
  // dibuat monoton naik — segmen lintas tengah malam dalam 'HH:MM' akan
  // mundur terhadap batas sebelumnya tanpa koreksi ini.
  const raw: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const ms = timelineBoundaryMs(segments[i].start, anchorDate);
    if (ms !== null) raw.push(ms);
  }
  const lastEnd = timelineBoundaryMs(segments[segments.length - 1].end, anchorDate);
  if (lastEnd !== null) raw.push(lastEnd);
  if (raw.length < 2) return { ticks: [], timeZoneLabel };
  const boundaries: number[] = [];
  for (const ms of raw) {
    let adjusted = ms;
    const prev = boundaries[boundaries.length - 1];
    while (prev !== undefined && adjusted < prev) adjusted += 24 * 3600_000;
    boundaries.push(adjusted);
  }
  const firstMs = boundaries[0];
  const lastMs = boundaries[boundaries.length - 1];
  const spanMin = (lastMs - firstMs) / 60000;
  if (spanMin <= 0) return { ticks: [], timeZoneLabel };
  // Batas adalah instant nyata bila ada jangkar tanggal atau ada segmen
  // ISO; tanpa keduanya, `ms` hanyalah menit relatif sejak tengah malam
  // (bukan instant) — label jam diambil dari menitnya langsung, tanpa
  // konversi zona waktu (yang akan menggesernya +07:00 secara salah).
  const realInstants =
    anchorDate !== null ||
    segments.some(
      (s) => Number.isFinite(Date.parse(s.start)) || Number.isFinite(Date.parse(s.end))
    );
  const stepMin =
    NICE_STEPS_MIN.find((step) => spanMin / step <= 8) ?? NICE_STEPS_MIN[NICE_STEPS_MIN.length - 1];
  const firstAbsMin = Math.floor(firstMs / 60000);
  const firstTickMin = Math.ceil(firstAbsMin / stepMin) * stepMin;
  const firstDateKey = dateKeyInJakarta(firstMs);
  const tickMs: number[] = [];
  for (let m = firstTickMin; m * 60000 <= lastMs; m += stepMin) tickMs.push(m * 60000);
  if (tickMs.length === 0 || tickMs[tickMs.length - 1] !== lastMs) tickMs.push(lastMs);
  const ticks: TimelineAxisTick[] = tickMs.map((ms) => {
    const clock = realInstants ? formatJakartaTime(ms) : minutesToClock(Math.round(ms / 60000));
    const dateKey = realInstants ? dateKeyInJakarta(ms) : null;
    const label =
      dateKey && firstDateKey && dateKey !== firstDateKey
        ? `${clock} · ${formatJakartaDateShort(ms)}`
        : clock;
    return { ms, label, pct: ((ms - firstMs) / (lastMs - firstMs)) * 100 };
  });
  return { ticks, timeZoneLabel };
}

/**
 * Penanda tanggal segmen yang melewati tengah malam, mis.
 * "16 Nov → 17 Nov" — kosong bila start/end satu tanggal Jakarta yang
 * sama atau tanggalnya tidak diketahui ('HH:MM' polos tanpa jangkar).
 */
export function segmentDateNote(seg: ShiftTimelineSegment): string {
  const startMs = Date.parse(seg.start);
  const endMs = Date.parse(seg.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '';
  const startDate = dateKeyInJakarta(startMs);
  const endDate = dateKeyInJakarta(endMs);
  if (!startDate || !endDate || startDate === endDate) return '';
  return `${formatJakartaDateShort(startMs)} → ${formatJakartaDateShort(endMs)}`;
}
