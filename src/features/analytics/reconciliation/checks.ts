/**
 * Tipe + ambang + pembangun check rekonsiliasi OEE (FAT-285, E32.4).
 *
 * Dipisah dari `features/analytics/reconciliation.ts` (406 baris) tanpa
 * mengubah perilaku. Dipakai `hourly.ts` + `timeline.ts`.
 *
 * Ambang peringatan (ditetapkan fix ini; tercantum juga di catatan kaki):
 * - Waktu: selisih > 60 detik ATAU > 1% dari nilai acuan (ringkasan).
 *   60 detik menoleransi pembulatan per-bucket; 1% menangkap drift yang
 *   kecil secara absolut tapi besar relatif terhadap jendela pendek.
 * - Parts: selisih > 1% dari nilai acuan (ringkasan). Parts adalah bilangan
 *   bulat — tidak ada toleransi pembulatan; 1% memberi ruang untuk selisih
 *   kecil (mis. 1–3 pcs dari 350) tanpa menyembunyikan gap nyata.
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
  /** Catatan tambahan, mis. "timeline dipotong ke jendela shift". */
  note?: string;
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
export function sumFinite(values: (number | undefined | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

/** Selisih waktu melewati ambang bila > 60 detik ATAU > 1% nilai acuan. */
export function timeExceeds(diffSec: number, referenceSec: number): boolean {
  const abs = Math.abs(diffSec);
  return (
    abs > RECONCILIATION_TIME_TOLERANCE_SEC ||
    abs > Math.abs(referenceSec) * RECONCILIATION_RELATIVE_TOLERANCE
  );
}

/** Selisih parts melewati ambang bila > 1% nilai acuan. */
export function partsExceeds(diff: number, reference: number): boolean {
  return Math.abs(diff) > Math.abs(reference) * RECONCILIATION_RELATIVE_TOLERANCE;
}

export function buildCheck(
  id: string,
  label: string,
  leftLabel: string,
  leftValue: number | null,
  rightLabel: string,
  rightValue: number | null,
  unit: ReconciliationUnit,
  exceeds: (diff: number, reference: number) => boolean,
  note?: string
): ReconciliationCheck {
  if (leftValue === null || rightValue === null) {
    return { id, label, leftLabel, leftValue, rightLabel, rightValue, unit, diff: null, status: 'unavailable', ...(note ? { note } : {}) };
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
    ...(note ? { note } : {}),
  };
}
