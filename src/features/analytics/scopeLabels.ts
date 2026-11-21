import { ShiftSummary } from '../../types/analytics';
import { Shift } from '../../types/production';
import { addDaysToDateString, isCrossMidnightShift, isTodayWindow } from '../../utils/historicalExport';
import type { RollupScope } from './hooks/oeeQueryKeys';

/**
 * E11 T11.5 (U-1 / FAT-45): label scope eksplisit di setiap widget.
 *
 * Pure formatter — TANPA fetch/query baru. Semua label di sini hanya
 * memformat data filter/query yang sudah aktif (from/to, window shift,
 * tz, nama mesin), supaya pengguna selalu tahu periode + scope tiap
 * widget. Bila datanya tidak ada / tidak bisa diparse, kembalikan string
 * kosong — pemanggil menghilangkan labelnya, bukan menebak-nebak.
 */

const ID_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/** Ambil HH:MM (wall-clock apa adanya, tanpa konversi zona waktu) dari string ISO. */
export function extractWallClockHhmm(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : null;
}

/** Format tanggal kalender dari string ISO sebagai "9 Nov 2026" (bagian tanggal apa adanya). */
export function formatIsoDateShort(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const month = ID_MONTHS_SHORT[Number(match[2]) - 1];
  if (!month) return null;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/**
 * Label periode dari from/to yang aktif. Rentang yang sama dengan preset
 * bawaan panel ditampilkan sebagai preset ("Hari ini", "7 hari terakhir",
 * dst.); rentang lain ditampilkan sebagai rentang tanggal
 * ("9 Nov 2026 – 16 Nov 2026"). String kosong bila from/to tidak ada
 * atau tidak valid.
 */
export function formatPeriodLabel(from?: string, to?: string, now: Date = new Date()): string {
  if (!from || !to) return '';
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return '';
  // E12 T12.9 (X-2 / FAT-62): jendela "hari ini" dicek dulu — durasinya
  // bisa mendekati 24 jam menjelang tengah malam.
  if (isTodayWindow(from, to, now)) return 'Hari ini';
  const diffMs = toMs - fromMs;
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  // Toleransi 5 menit: from/to dihitung dari `new Date()` saat filter dibuat.
  const approx = (target: number) => Math.abs(diffMs - target) <= 5 * 60 * 1000;
  if (approx(dayMs)) return '24 jam terakhir';
  if (approx(7 * dayMs)) return '7 hari terakhir';
  if (approx(30 * dayMs)) return '30 hari terakhir';
  // Preset 90d panel = retensi 90 hari dikurangi 1 jam (resolveTimeWindowPreset).
  if (approx(90 * dayMs - hourMs)) return '90 hari terakhir';
  const fromLabel = formatIsoDateShort(from);
  const toLabel = formatIsoDateShort(to);
  if (!fromLabel || !toLabel) return '';
  return `${fromLabel} – ${toLabel}`;
}

/**
 * Label shift dari data ShiftSummary: nama shift + jam window + tz,
 * mis. "Shift 1 (07:00-15:00) · Asia/Jakarta". Rentang jam tidak
 * ditambahkan bila nama shift sudah memuatnya (seed demo).
 * String kosong bila tidak ada nama shift yang bermakna.
 */
export function formatShiftScopeLabel(summary: ShiftSummary | null | undefined): string {
  if (!summary) return '';
  const shiftName = (summary.shift_name || '').trim();
  if (!shiftName) return '';
  const start = extractWallClockHhmm(summary.shift_start);
  const end = extractWallClockHhmm(summary.shift_end);
  let label = shiftName;
  if (start && end) {
    const rangeEnDash = `${start}–${end}`;
    const rangeHyphen = `${start}-${end}`;
    if (!label.includes(rangeEnDash) && !label.includes(rangeHyphen)) {
      label = `${label} · ${rangeEnDash}`;
    }
  }
  if (summary.tz) label = `${label} · ${summary.tz}`;
  return label;
}

/**
 * Label lengkap kartu ringkasan: shift (+ tz) + mesin, dari data summary
 * itu sendiri. Bila summary tidak membawa info shift yang bermakna
 * (mis. nama shift hanya fallback "Shift" tanpa window/tz), pakai label
 * periode filter aktif sebagai gantinya — jangan tampilkan tebakan.
 */
export function formatSummaryScopeLabel(
  summary: ShiftSummary | null | undefined,
  fallbackPeriodLabel?: string
): string {
  if (!summary) return fallbackPeriodLabel ?? '';
  const shiftLabel = formatShiftScopeLabel(summary);
  const hasWindow =
    Boolean(extractWallClockHhmm(summary.shift_start)) &&
    Boolean(extractWallClockHhmm(summary.shift_end));
  const meaningfulShift = shiftLabel !== '' && (shiftLabel !== 'Shift' || hasWindow || Boolean(summary.tz));
  const base = meaningfulShift ? shiftLabel : (fallbackPeriodLabel ?? '');
  if (!base) return '';
  const machine = (summary.machine_name || summary.machine_id || '').trim();
  return machine ? `${base} · Mesin ${machine}` : base;
}

/**
 * E12 T12.1 (X-1 / FAT-54): label filter shift dari pilihan tanggal + shift
 * yang aktif, mis. "Shift 1 (Pagi) · 16 Nov 2026 · 07:00–15:00". Shift
 * lintas tengah malam diberi penanda "(+1 hari)" pada jam akhirnya.
 * String kosong bila shift/tanggal tidak ada atau tidak valid — pemanggil
 * memakai formatPeriodLabel(from, to) sebagai gantinya.
 */
export function formatShiftFilterLabel(
  shift: Shift | null | undefined,
  date: string | undefined | null
): string {
  if (!shift || !date) return '';
  // Tanggal kalender harus benar-benar ada (formatIsoDateShort saja tidak
  // memvalidasi, mis. 2026-02-30 lolos regex).
  if (addDaysToDateString(date, 0) === null) return '';
  const dateLabel = formatIsoDateShort(`${date}T00:00:00`);
  if (!dateLabel) return '';
  const name = (shift.shiftName || '').trim();
  if (!name) return '';
  const start = (shift.startTime || '').trim();
  const end = (shift.endTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return `${name} · ${dateLabel}`;
  }
  const range = isCrossMidnightShift(shift) ? `${start}–${end} (+1 hari)` : `${start}–${end}`;
  return `${name} · ${dateLabel} · ${range}`;
}

/** Gabungkan bagian-bagian label scope, lewati bagian yang kosong. */
export function joinScopeLabel(...parts: (string | undefined | null)[]): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter((p) => p !== '')
    .join(' · ');
}

/**
 * E12 T12.10 (X-3 / FAT-57): judul tabel rollup menurut scope yang aktif —
 * "Rollup — <nama mesin>" untuk scope mesin ini, "Rollup — Semua Mesin"
 * untuk scope plant-wide. Satu-satunya sumber judul rollup; jangan
 * membangun judul rollup di tempat lain.
 */
export function formatRollupScopeTitle(scope: RollupScope, machineLabel: string): string {
  return scope === 'ALL' ? 'Rollup — Semua Mesin' : `Rollup — ${machineLabel}`;
}
