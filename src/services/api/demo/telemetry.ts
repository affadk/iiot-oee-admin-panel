/**
 * BARREL — komposisi demoTelemetry per domain (tanpa logika bisnis).
 *
 * Dipisah dari file 725 baris pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: oee → rollup → quality → history → reconciliation.
 */
import { demoTelemetryOee } from './telemetry/oee';
import { demoTelemetryRollup } from './telemetry/rollup';
import { demoTelemetryQuality } from './telemetry/quality';
import { demoTelemetryHistory } from './telemetry/history';
import { demoTelemetryReconciliation } from './telemetry/reconciliation';

export const demoTelemetry = {
  ...demoTelemetryOee,
  ...demoTelemetryRollup,
  ...demoTelemetryQuality,
  ...demoTelemetryHistory,
  ...demoTelemetryReconciliation,
};
