/**
 * Rekonsiliasi halaman OEE (gap G2) — BARREL + orkestrasi (FAT-285, E32.4).
 *
 * E12 T12.6 (U-3 / FAT-56): indikator rekonsiliasi halaman OEE.
 *
 * Pure helper — TANPA fetch/query baru. Membandingkan angka-angka yang
 * sudah dimuat halaman OEE (ringkasan shift, tabel per jam, timeline) dan
 * menandai selisih yang melewati ambang. Hasilnya ditampilkan sebagai
 * catatan kaki, bukan blokir: ketidakcocokan menjadi terlihat dan bisa
 * ditindaklanjuti, bukan disembunyikan.
 *
 * Perbandingan ini mengasumsikan ketiganya mencakup jendela yang sama
 * (jendela filter halaman yang sama — default 7 hari). Bila filter
 * mempersempit salah satu sumber (mis. rentang kustom / shift yang
 * dipotong), peringatan bisa muncul karena jendela yang berbeda — bukan
 * karena datanya salah.
 *
 * Dipisah dari satu file 406 baris menjadi modul per tanggung jawab di
 * `reconciliation/` — tanpa mengubah perilaku apa pun:
 *
 *   - `reconciliation/checks.ts` ... tipe, ambang, `buildCheck`
 *   - `reconciliation/hourly.ts` .. check Σ jam vs ringkasan
 *   - `reconciliation/timeline.ts` . check timeline vs ringkasan
 *     (termasuk diagnosis FAT-221: jendela ringkasan = jendela filter,
 *     timeline gapless server — lihat komentar di file itu)
 *   - `reconciliation/format.ts` .. format nilai + selisih
 *
 * Semua impor lama (`./reconciliation`) tetap jalan lewat re-export
 * di bawah ini.
 */
import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../types/analytics';
import { OeeReconciliation, ReconciliationCheck } from './reconciliation/checks';
import { buildHourlyChecks } from './reconciliation/hourly';
import { buildTimelineChecks } from './reconciliation/timeline';

export {
  RECONCILIATION_TIME_TOLERANCE_SEC,
  RECONCILIATION_RELATIVE_TOLERANCE,
} from './reconciliation/checks';
export type {
  ReconciliationUnit,
  ReconciliationStatus,
  ReconciliationCheck,
  OeeReconciliation,
} from './reconciliation/checks';
export { formatReconciliationValue, formatReconciliationDiff } from './reconciliation/format';

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
  const checks: ReconciliationCheck[] = [
    ...buildHourlyChecks(summary, hourly),
    ...buildTimelineChecks(summary, timeline),
  ];
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  return {
    checks,
    warningCount,
    isConsistent: warningCount === 0,
    hasData: checks.length > 0,
  };
}
