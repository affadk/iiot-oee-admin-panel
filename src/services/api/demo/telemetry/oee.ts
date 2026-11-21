/**
 * BARREL — komposisi demoTelemetryOee per sub-domain (tanpa logika bisnis).
 *
 * Dipisah dari file 489 baris pada E32.5 (FAT-286), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: summary → hourly.
 *
 * buildDemoHourlyPoints + deriveShiftSummaryFromHourly tetap diekspor
 * dari sini (dipakai oee.test.ts).
 */
import { demoTelemetryOeeSummary } from './oee/summary';
import { demoTelemetryOeeHourly } from './oee/hourly';

export { buildDemoHourlyPoints, deriveShiftSummaryFromHourly } from './oee/seed';
export type { DerivedShiftSummary } from './oee/seed';

export const demoTelemetryOee = {
  ...demoTelemetryOeeSummary,
  ...demoTelemetryOeeHourly,
};
