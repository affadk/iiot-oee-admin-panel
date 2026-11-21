import { TimeWindowPreset } from '../../types/historical';
import { RETENTION_POLICY_DAYS } from './constants';
import { PLANT_TIME_ZONE_OFFSET, dateKeyInJakarta, jakartaDateParts } from './timezone';

/**
 * Formats a Date into ISO 8601 with explicit timezone offset
 * (e.g. `2026-11-01T00:00:00+07:00`).
 *
 * E12 T12.11 (X-4 / FAT-59): wall-clock yang ditulis adalah wall-clock
 * Asia/Jakarta (bukan lokal browser) dan offset-nya selalu `+07:00` —
 * `from`/`to` yang dikirim ke server kini selalu dalam zona waktu
 * tunggal pabrik, di mana pun panel dibuka.
 */
export function formatIsoWithOffset(date: Date = new Date()): string {
  const parts = jakartaDateParts(date) ?? {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${PLANT_TIME_ZONE_OFFSET}`;
}

export function resolveTimeWindowPreset(
  preset: TimeWindowPreset,
  now: Date = new Date()
): { from: string; to: string } {
  const to = formatIsoWithOffset(now);
  const msPerHour = 60 * 60 * 1000;
  const msPerDay = 24 * msPerHour;

  switch (preset) {
    // E12 T12.9 (X-2 / FAT-62) + E12 T12.11 (X-4 / FAT-59): "Hari ini" —
    // dari tengah malam Asia/Jakarta hari ini sampai sekarang (bukan
    // 24 jam terakhir yang bisa mencakup kemarin, dan bukan tengah malam
    // lokal browser — `setHours(0,0,0,0)` memakai zona waktu mesin).
    case 'today': {
      const dateKey = dateKeyInJakarta(now);
      if (!dateKey) return { from: formatIsoWithOffset(now), to };
      return { from: `${dateKey}T00:00:00${PLANT_TIME_ZONE_OFFSET}`, to };
    }
    case '24h':
      return { from: formatIsoWithOffset(new Date(now.getTime() - msPerDay)), to };
    case '7d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
    case '30d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 30 * msPerDay)), to };
    case '90d':
      return {
        from: formatIsoWithOffset(
          new Date(now.getTime() - (RETENTION_POLICY_DAYS * msPerDay - msPerHour))
        ),
        to,
      };
    case 'custom':
    default:
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
  }
}

const ISO_OFFSET_REGEX = /([+-])(\d{2}):(\d{2})$/;

/**
 * Tanggal kalender (YYYY-MM-DD) dari `now` sebagaimana terlihat pada zona
 * waktu `offset` ('+07:00' / '-05:00' / 'Z'). Perbandingan tanggal
 * dilakukan pada offset yang tertulis di string ISO itu sendiri, bukan
 * zona waktu lokal mesin — supaya "hari ini" benar di browser pengguna
 * (Asia/Jakarta) maupun di runner test (UTC).
 */
function datePartInOffset(now: Date, offset: string): string | null {
  const match = offset === 'Z' ? null : ISO_OFFSET_REGEX.exec(offset);
  const minutes =
    offset === 'Z'
      ? 0
      : match
        ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
        : null;
  if (minutes === null) return null;
  const shifted = new Date(now.getTime() + minutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * E12 T12.9 (X-2 / FAT-62): benar bila [from, to] adalah jendela "hari
 * ini" — from tepat tengah malam (00:00, wall-clock pada offset-nya) pada
 * tanggal hari ini, dan to jatuh pada tanggal hari ini juga. String ISO
 * tanpa offset / tanggal tidak valid -> false.
 */
export function isTodayWindow(from: string, to: string, now: Date = new Date()): boolean {
  const fromDate = from.slice(0, 10);
  const fromClock = from.slice(11, 16);
  const toDate = to.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || fromClock !== '00:00') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return false;
  const fromOffset = from.endsWith('Z') ? 'Z' : (ISO_OFFSET_REGEX.exec(from)?.[0] ?? null);
  const toOffset = to.endsWith('Z') ? 'Z' : (ISO_OFFSET_REGEX.exec(to)?.[0] ?? null);
  if (!fromOffset || !toOffset) return false;
  const todayFrom = datePartInOffset(now, fromOffset);
  const todayTo = datePartInOffset(now, toOffset);
  return todayFrom !== null && todayTo !== null && fromDate === todayFrom && toDate === todayTo;
}

/**
 * E12 T12.9 (X-2 / FAT-62): tebak preset dari [from, to] yang aktif —
 * dipakai pemilih rentang supaya tombol preset yang tersorot selalu
 * mencerminkan rentang di URL (bisa dibagikan/direfresh), bukan state
 * lokal yang kedaluwarsa. 'today' dicek dulu (durasi hari ini bisa
 * mendekati 24 jam menjelang tengah malam); preset durasi memakai
 * toleransi 5 menit yang sama dengan `formatPeriodLabel`. Rentang lain
 * (mis. jendela shift 8 jam) -> 'custom'.
 */
export function detectTimeWindowPreset(
  from: string,
  to: string,
  now: Date = new Date()
): TimeWindowPreset {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 'custom';
  if (isTodayWindow(from, to, now)) return 'today';
  const diffMs = toMs - fromMs;
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  // Toleransi 5 menit: from/to dihitung dari `new Date()` saat filter dibuat.
  const approx = (target: number) => Math.abs(diffMs - target) <= 5 * 60 * 1000;
  if (approx(dayMs)) return '24h';
  if (approx(7 * dayMs)) return '7d';
  if (approx(30 * dayMs)) return '30d';
  // Preset 90d panel = retensi 90 hari dikurangi 1 jam (resolveTimeWindowPreset).
  if (approx(90 * dayMs - hourMs)) return '90d';
  return 'custom';
}

const SHIFT_CLOCK_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SHIFT_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'HH:MM' -> menit sejak tengah malam, atau null bila format tidak valid. */
export function parseShiftClock(value: string): number | null {
  const match = SHIFT_CLOCK_REGEX.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 'YYYY-MM-DD' + N hari (aritmetika kalender UTC — tanpa pengaruh zona waktu lokal). */
export function addDaysToDateString(date: string, days: number): string | null {
  const match = SHIFT_DATE_REGEX.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null; // tanggal kalender tidak ada (mis. 2026-02-30)
  }
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * E12 T12.1 (X-1 / FAT-54): shift lintas tengah malam — endTime <= startTime
 * berarti shift berakhir keesokan harinya (endTime == startTime = shift 24 jam).
 */
export function isCrossMidnightShift(shift: { startTime: string; endTime: string }): boolean {
  const startMin = parseShiftClock(shift.startTime);
  const endMin = parseShiftClock(shift.endTime);
  return startMin !== null && endMin !== null && endMin <= startMin;
}

/**
 * E12 T12.1 (X-1 / FAT-54): jendela [from, to] satu shift pada satu tanggal
 * kalender, dari definisi shift yang sudah ada (Shift.startTime/endTime
 * 'HH:MM' — seed SHIFT-1 07:00–15:00, SHIFT-2 15:00–23:00, SHIFT-3
 * 00:00–07:00). Cross-midnight safe: `to` jatuh pada tanggal berikutnya
 * bila endTime <= startTime.
 *
 * `offset` eksplisit (mis. '+07:00' dari from/to yang sudah ada) membuat
 * hasil deterministik tanpa konversi zona waktu lokal mesin — dipakai sisi
 * demo; tanpa offset, dipakai offset pabrik `+07:00` (E12 T12.11 / X-4 —
 * sebelumnya offset lokal browser, sehingga jendela shift bergeser menurut
 * mesin yang membuka panel). Null bila shift/tanggal tidak valid.
 */
export function resolveShiftWindow(
  shift: { startTime: string; endTime: string },
  date: string,
  offset?: string
): { from: string; to: string } | null {
  const startMin = parseShiftClock(shift.startTime);
  const endMin = parseShiftClock(shift.endTime);
  if (startMin === null || endMin === null) return null;
  const endDate = isCrossMidnightShift(shift) ? addDaysToDateString(date, 1) : date;
  if (!endDate || !SHIFT_DATE_REGEX.test(date) || addDaysToDateString(date, 0) === null) {
    return null;
  }
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const startClock = `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`;
  const endClock = `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`;
  const off = offset ?? PLANT_TIME_ZONE_OFFSET;
  return {
    from: `${date}T${startClock}:00${off}`,
    to: `${endDate}T${endClock}:00${off}`,
  };
}
