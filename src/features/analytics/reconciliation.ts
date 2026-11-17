import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../types/analytics';

/**
 * E12 T12.6 (U-3 / FAT-56): indikator rekonsiliasi halaman OEE (gap G2).
 *
 * Pure helper — TANPA fetch/query baru. Membandingkan angka-angka yang
 * sudah dimuat halaman OEE (ringkasan shift, tabel per jam, timeline) dan
 * menandai selisih yang melewati ambang. Hasilnya ditampilkan sebagai
 * catatan kaki, bukan blokir: ketidakcocokan menjadi terlihat dan bisa
 * ditindaklanjuti, bukan disembunyikan.
 *
 * Ambang peringatan (ditetapkan fix ini; tercantum juga di catatan kaki):
 * - Waktu: selisih > 60 detik ATAU > 1% dari nilai acuan (ringkasan).
 *   60 detik menoleransi pembulatan per-bucket; 1% menangkap drift yang
 *   kecil secara absolut tapi besar relatif terhadap jendela pendek.
 * - Parts: selisih > 1% dari nilai acuan (ringkasan). Parts adalah bilangan
 *   bulat — tidak ada toleransi pembulatan; 1% memberi ruang untuk selisih
 *   kecil (mis. 1–3 pcs dari 350) tanpa menyembunyikan gap nyata.
 *
 * Perbandingan ini mengasumsikan ketiganya mencakup jendela yang sama
 * (satu shift yang sama). Bila filter mempersempit salah satu sumber
 * (mis. rentang kustom / shift yang dipotong), peringatan bisa muncul
 * karena jendela yang berbeda — bukan karena datanya salah.
 */

/** Toleransi absolut waktu: 60 detik. */
export const RECONCILIATION_TIME_TOLERANCE_SEC = 60;

/** Toleransi relatif: 1% dari nilai acuan (ringkasan). */
export const RECONCILIATION_RELATIVE_TOLERANCE = 0.01;

export type ReconciliationUnit = 'detik' | 'menit' | 'pcs';

export type ReconciliationStatus = 'ok' | 'warning' | 'unavailable';

export interface ReconciliationCheck {
  id: string;
  /** Judul baris, mis. "Run time — Σ jam vs ringkasan". */
  label: string;
  leftLabel: string;
  /** Nilai sisi kiri dalam `unit`; null bila sumbernya tidak lengkap. */
  leftValue: number | null;
  rightLabel: string;
  /** Nilai sisi kanan (ringkasan) dalam `unit`; null bila tidak ada. */
  rightValue: number | null;
  unit: ReconciliationUnit;
  /** Selisih (kiri − kanan) dalam `unit`; null bila tidak bisa dihitung. */
  diff: number | null;
  status: ReconciliationStatus;
}

export interface OeeReconciliation {
  checks: ReconciliationCheck[];
  warningCount: number;
  /** True bila tidak ada check yang berstatus warning. */
  isConsistent: boolean;
  /** True bila ada setidaknya satu check yang bisa dihitung. */
  hasData: boolean;
}

/** Jumlahkan; null bila ada satu saja nilai yang hilang / bukan angka. */
function sumFinite(values: (number | undefined | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

/** Selisih waktu melewati ambang bila > 60 detik ATAU > 1% nilai acuan. */
function timeExceeds(diffSec: number, referenceSec: number): boolean {
  const abs = Math.abs(diffSec);
  return (
    abs > RECONCILIATION_TIME_TOLERANCE_SEC ||
    abs > Math.abs(referenceSec) * RECONCILIATION_RELATIVE_TOLERANCE
  );
}

/** Selisih parts melewati ambang bila > 1% nilai acuan. */
function partsExceeds(diff: number, reference: number): boolean {
  return Math.abs(diff) > Math.abs(reference) * RECONCILIATION_RELATIVE_TOLERANCE;
}

function buildCheck(
  id: string,
  label: string,
  leftLabel: string,
  leftValue: number | null,
  rightLabel: string,
  rightValue: number | null,
  unit: ReconciliationUnit,
  exceeds: (diff: number, reference: number) => boolean
): ReconciliationCheck {
  if (leftValue === null || rightValue === null) {
    return { id, label, leftLabel, leftValue, rightLabel, rightValue, unit, diff: null, status: 'unavailable' };
  }
  const diff = leftValue - rightValue;
  return {
    id,
    label,
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    unit,
    diff,
    status: exceeds(diff, rightValue) ? 'warning' : 'ok',
  };
}

/**
 * Hitung rekonsiliasi dari data yang sudah dimuat halaman OEE.
 * Tidak ada check bila summary null (halaman menampilkan empty/error
 * state-nya sendiri); check per sumber hanya dibuat bila sumber itu ada.
 */
export function computeOeeReconciliation(
  summary: ShiftSummary | null | undefined,
  hourly: HourlyOeePoint[],
  timeline: ShiftTimelineSegment[]
): OeeReconciliation {
  if (!summary) {
    return { checks: [], warningCount: 0, isConsistent: true, hasData: false };
  }
  const checks: ReconciliationCheck[] = [];

  if (hourly.length > 0) {
    const hourlyRunSec = sumFinite(hourly.map((p) => p.hourly_run_sec));
    checks.push(
      buildCheck(
        'hourly-run-vs-summary',
        'Run time — Σ jam vs ringkasan',
        'Σ hourly_run_sec',
        hourlyRunSec,
        'run_time_min (ringkasan)',
        summary.run_time_min * 60,
        'detik',
        timeExceeds
      )
    );

    const hourlyParts = sumFinite(hourly.map((p) => p.parts_produced));
    checks.push(
      buildCheck(
        'hourly-parts-vs-summary',
        'Total parts — Σ jam vs ringkasan',
        'Σ parts_produced',
        hourlyParts,
        'total_parts (ringkasan)',
        summary.total_parts,
        'pcs',
        partsExceeds
      )
    );

    const hourlyGood = sumFinite(hourly.map((p) => p.good_count));
    checks.push(
      buildCheck(
        'hourly-good-vs-summary',
        'Good parts — Σ jam vs ringkasan',
        'Σ good_count',
        hourlyGood,
        'good_parts (ringkasan)',
        summary.good_parts,
        'pcs',
        partsExceeds
      )
    );

    const hourlyDefect = sumFinite(hourly.map((p) => p.defect_count));
    checks.push(
      buildCheck(
        'hourly-defect-vs-summary',
        'Defect — Σ jam vs ringkasan',
        'Σ defect_count',
        hourlyDefect,
        'defect_parts (ringkasan)',
        summary.defect_parts,
        'pcs',
        partsExceeds
      )
    );
  }

  if (timeline.length > 0) {
    const durationByState = new Map<string, number | null>();
    for (const state of ['RUNNING', 'PLANNED_DOWNTIME', 'UNPLANNED_DOWNTIME']) {
      durationByState.set(
        state,
        sumFinite(
          timeline.filter((s) => s.fsm_state === state).map((s) => s.duration_min)
        )
      );
    }
    const timelineTotalMin = sumFinite(timeline.map((s) => s.duration_min));

    checks.push(
      buildCheck(
        'timeline-running-vs-summary',
        'RUNNING timeline vs ringkasan',
        'Σ durasi RUNNING (timeline)',
        durationByState.get('RUNNING') ?? null,
        'run_time_min (ringkasan)',
        summary.run_time_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60)
      )
    );
    checks.push(
      buildCheck(
        'timeline-planned-vs-summary',
        'Planned downtime timeline vs ringkasan',
        'Σ durasi PLANNED_DOWNTIME (timeline)',
        durationByState.get('PLANNED_DOWNTIME') ?? null,
        'planned_downtime_min (ringkasan)',
        summary.planned_downtime_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60)
      )
    );
    checks.push(
      buildCheck(
        'timeline-unplanned-vs-summary',
        'Unplanned downtime timeline vs ringkasan',
        'Σ durasi UNPLANNED_DOWNTIME (timeline)',
        durationByState.get('UNPLANNED_DOWNTIME') ?? null,
        'unplanned_downtime_min (ringkasan)',
        summary.unplanned_downtime_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60)
      )
    );
    checks.push(
      buildCheck(
        'timeline-total-vs-window',
        'Total durasi timeline vs jendela shift',
        'Σ durasi timeline',
        timelineTotalMin,
        'planned_production_time_min (ringkasan)',
        summary.planned_production_time_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60)
      )
    );
  }

  const warningCount = checks.filter((c) => c.status === 'warning').length;
  return {
    checks,
    warningCount,
    isConsistent: warningCount === 0,
    hasData: checks.length > 0,
  };
}

/** Format nilai + satuan cara Indonesia, mis. "23.280 detik", "388 menit", "334 pcs". */
export function formatReconciliationValue(value: number | null, unit: ReconciliationUnit): string {
  if (value === null) return '—';
  return `${value.toLocaleString('id-ID')} ${unit}`;
}

/** Teks selisih dengan tanda, mis. "+16 pcs", "−120 detik"; "" bila nol/null. */
export function formatReconciliationDiff(diff: number | null, unit: ReconciliationUnit): string {
  if (diff === null || diff === 0) return '';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${Math.abs(diff).toLocaleString('id-ID')} ${unit}`;
}
