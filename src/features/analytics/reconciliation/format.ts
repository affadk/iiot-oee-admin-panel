/**
 * Format tampilan nilai + selisih rekonsiliasi OEE (FAT-285, E32.4).
 *
 * Dipisah dari `features/analytics/reconciliation.ts` (406 baris) tanpa
 * mengubah perilaku.
 */
import { ReconciliationUnit } from './checks';

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
