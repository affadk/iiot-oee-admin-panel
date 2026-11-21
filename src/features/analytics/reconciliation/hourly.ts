/**
 * Check rekonsiliasi per-jam — Σ hourly vs ringkasan (FAT-285, E32.4).
 *
 * Dipisah dari `features/analytics/reconciliation.ts` (406 baris) tanpa
 * mengubah perilaku: empat check (run time, total parts, good, defect)
 * yang membandingkan penjumlahan bucket jam terhadap ringkasan shift.
 */
import { HourlyOeePoint, ShiftSummary } from '../../../types/analytics';
import { buildCheck, partsExceeds, sumFinite, timeExceeds, ReconciliationCheck } from './checks';

/** Empat check Σ jam vs ringkasan; [] bila tidak ada data jam. */
export function buildHourlyChecks(summary: ShiftSummary, hourly: HourlyOeePoint[]): ReconciliationCheck[] {
  if (hourly.length === 0) return [];
  const checks: ReconciliationCheck[] = [];

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

  return checks;
}
