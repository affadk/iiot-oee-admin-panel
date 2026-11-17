/**
 * Default tampilan telemetry / OEE — SATU sumber kebenaran (E12 T12.18).
 *
 * E12 T12.18 (U-4 / FAT-65, gap G15): default panel sebelumnya berbeda dari
 * dokumen tanpa catatan, dan literalnya diduplikasi di dua halaman
 * (Telemetry History + OEE Analytics) sehingga mudah drift. Nilai di sini
 * adalah nilai DOKUMEN:
 * - groupBy rollup `day` — API doc §K.3c (`group_by` default `day`).
 * - bucket aggregate `5m` — Build Guide tabel endpoint §4.1 (default `5m`).
 * - bucket timeline `5m` — API doc §Q.3 (default dokumen `5m`).
 *   Re-bucketing demo T11.4 sudah memverifikasi Σ per state tetap 388/60/32
 *   di bucket 5m, jadi perubahan default ini aman.
 *
 * Default transport (bukan UI) hidup di tempatnya masing-masing dan ikut
 * disamakan di fix yang sama: limit hourly HTTP 72 (Guide tabel endpoint +
 * API doc §E "default 72 bucket terakhir"), limit rollup HTTP 500 (API doc
 * §K.3c), timeout ekspor 120.000 ms (Guide §4.2 +
 * `VITE_EXPORT_TIMEOUT_MS` di `services/api/mode.ts`).
 *
 * Yang SENGAJA dipertahankan dan BUKAN bagian dari modul ini: ukuran
 * halaman UI 50 (`DEFAULT_HISTORY_PAGE_LIMIT`) — itu ukuran paginasi
 * halaman yang dipilih pengguna per halaman, bukan default dokumen
 * endpoint; mengubahnya akan ikut mengubah halaman raw/downtime lain.
 */

import type { TelemetryRollupGroupBy } from '../../types/analytics';
import type { AggBucket } from './hooks/useTelemetryQueries';
import type { TimelineBucket } from './hooks/oeeQueryKeys';

/** API doc §K.3c: `group_by` (`machine|day|month`, default `day`). */
export const DEFAULT_ROLLUP_GROUP_BY: TelemetryRollupGroupBy = 'day';

/** Build Guide tabel endpoint: bucket aggregate default `5m`. */
export const DEFAULT_AGGREGATE_BUCKET: AggBucket = '5m';

/** API doc §Q.3: bucket timeline default `5m`. */
export const DEFAULT_TIMELINE_BUCKET: TimelineBucket = '5m';
