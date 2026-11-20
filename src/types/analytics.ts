import { MachineFsmState } from './monitoring';

export interface ShiftSummary {
  /**
   * E23 Batch 3 (FAT-196, N-27): spec live TIDAK mengirim nama shift/mesin
   * maupun totalCount/goodCount/rejectCount — `null` berarti "tidak
   * dikirim server", BUKAN 0/'Shift'/''. Parts diturunkan mapper dari
   * hourly[] bila include_hourly dikembalikan (pola N-11); tanpa hourly
   * → null. Demo tetap mengisi angka (diturunkan dari Σ hourly, E12).
   */
  shift_name: string | null;
  machine_id: string;
  machine_name: string | null;
  shift_start: string;
  shift_end: string;
  tz?: string;
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  planned_production_time_min: number;
  planned_break_min?: number;
  operating_time_min: number;
  run_time_min: number;
  unplanned_downtime_min: number;
  planned_downtime_min: number;
  total_parts: number | null;
  good_parts: number | null;
  defect_parts: number | null;
  target_per_hour?: number | null;
  /**
   * E20 P20.5 (FAT-157): rantai `hourly[]` respons §Q.1 — hanya ada bila
   * `include_hourly=true` diminta. Sebelumnya mapper membuangnya.
   */
  hourly?: HourlyOeePoint[];
}

export interface HourlyOeePoint {
  hour: string;
  bucket?: string;
  /**
   * E20 P20.5 (FAT-157): `*Pct` nullable (API doc §K 1163, §7J) — bucket
   * tanpa sampel / kapasitas unknown bernilai `null`, BUKAN 0. D-8: oee
   * null saat performance null (bukan 0).
   */
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  /**
   * E28 Batch A (FAT-218 E2E-04 + FAT-213 N-43): `parts_produced` null =
   * totalCount tidak dikirim server (jumlah tidak diketahui) — tampil '—',
   * BUKAN 0. Pola yang sama dengan `*Pct` (pctOrNull) di atas.
   */
  parts_produced: number | null;
  defect_count: number;
  good_count?: number;
  hourly_operating_sec?: number;
  hourly_run_sec?: number;
  // E12 T12.14 (F-10 / FAT-66): `hourly_downtime_sec` DIHAPUS dari kontrak
  // (API doc §D1) — downtime sumber kebenarannya ada di
  // `downtime_events.duration_sec`, bukan di titik per jam. Jangan
  // menambahkannya kembali ke tipe ini.
  sampleCount?: number;
  targetPerHour?: number | null;
  state?: MachineFsmState | null;
  planned?: boolean;
  provisional?: boolean;
  /** E20 P20.5 (FAT-157): identitas baris §Q.2 — sebelumnya dibuang mapper. */
  deviceId?: string | null;
  machineId?: string | null;
  woId?: string | null;
}

/**
 * Rentang waktu (+ limit) untuk query telemetry per jam / agregat.
 * Dipakai konsisten oleh mode Demo dan Real (E11 T11.1 / F-1): tanpa
 * options, perilaku sama seperti sebelumnya (default server/demo).
 *
 * E12 T12.1 (X-1 / FAT-54): `date` (YYYY-MM-DD, tanggal mulai shift) dan
 * `shift` (kode shift, mis. 'S1' — Shift.shiftCode) adalah parameter yang
 * didefinisikan API doc §I untuk shift-summary/timeline
 * (`?date=&shift=`); dikirim BERSAMA from/to (jendela shift yang sama)
 * supaya server bisa memakai definisi shift-nya sendiri, bukan hanya
 * jendela mentah. Tanpa keduanya, perilaku sama seperti sebelumnya.
 */
export interface TelemetryRangeOptions {
  from?: string;
  to?: string;
  limit?: number;
  date?: string;
  shift?: string;
  /**
   * E20 P20.5 (FAT-157): `include_hourly=true` meminta rantai `hourly[]`
   * pada shift-summary (API doc §Q.1).
   */
  include_hourly?: boolean;
}

export interface TelemetryAggregatePoint {
  bucket: string;
  totalCount: number;
  goodCount: number;
  rejectCount: number;
  operatingSec: number;
  runSec: number;
  /** E20 P20.5 (FAT-157): `*Pct` string-numeric nullable (§7J) — bukan 0. */
  availabilityPct: string | number | null;
  performancePct: string | number | null;
  qualityPct: string | number | null;
  oeePct: string | number | null;
  sampleCount: number;
  provisional: boolean;
  /**
   * E23 Batch 1 (FAT-180, N-11): delta per bucket dari spec live — sumber
   * count bila `totalCount/goodCount/rejectCount` absen (mapper menurunkan
   * count dari delta ini).
   */
  outputDelta?: number | null;
  goodDelta?: number | null;
  rejectDelta?: number | null;
}

/**
 * Hasil `getTelemetryAggregate` — ringkasan + SELURUH deret per-bucket.
 *
 * E12 T12.2 (F-5 / FAT-51): sebelumnya hanya `rows[0]` yang dipakai sebagai
 * satu kartu ringkasan dan deretnya dibuang. Ringkasan dipertahankan agar
 * strip ringkasan tetap bekerja; `rows` adalah deret yang dirender tab
 * Aggregate (tabel + grafik). Ringkasan dihitung dari seluruh rows (HTTP)
 * atau nilai seed keseluruhan (demo) — lihat masing-masing transport.
 */
export interface TelemetryAggregateResult {
  device_id: string;
  bucket: string;
  avg_oee: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  total_parts: number;
  sample_count: number;
  rows: TelemetryAggregatePoint[];
}

export interface ShiftTimelineSegment {
  start: string;
  end: string;
  fsm_state: MachineFsmState;
  planned?: boolean;
  downtime_id?: string | null;
  duration_min: number;
}

export interface RejectParetoItem {
  reason: string;
  count: number;
  /** Persen terhadap total; opsional — demo seed hanya membawa `percentage`. */
  pct?: number;
  percentage: number;
  cumulative_percentage: number;
}

export interface TelemetryHistoryRecord {
  id: string;
  device_id: string;
  timestamp: string;
  fsm_state: MachineFsmState;
  total_count: number;
  good_count: number;
  reject_count: number;
  totalCount?: number;
  goodCount?: number;
  rejectCount?: number;
  operatingTimeSec?: number;
  runTimeSec?: number;
  downtimeSec?: number;
  lastCycleTimeSec?: number | null;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  cycle_time_ms: number;
  temperature_c?: number;
  vibration_rms?: number;
  is_buffered?: boolean;
}

/**
 * E23 Batch 3 (FAT-195, N-26): spec live `group_by` mencakup 'line'
 * (machine|line|day|month, default day) — panel lama tak mengenalnya dan
 * mustParse melempar bila server mengembalikan baris groupBy 'line'.
 */
export type TelemetryRollupGroupBy = 'machine' | 'line' | 'day' | 'month';

export interface TelemetryRollupQuery {
  group_by: TelemetryRollupGroupBy;
  machine_id?: string;
  device_id?: string;
  from: string;
  to: string;
  limit?: number;
  cursor?: string | null;
  envelope?: boolean;
}

export interface TelemetryRollupItem {
  groupBy: TelemetryRollupGroupBy;
  /** Kunci unik baris untuk paginasi cursor (demo: machine/device/hari/bulan). */
  groupKey: string;
  bucket: string | null;
  machineId: string | null;
  machine_id?: string | null;
  machine_name?: string | null;
  device_id?: string | null;
  /** E23 Batch 3 (FAT-195, N-26): `lineId` dari item rollup spec live. */
  lineId?: string | null;
  totalCount: number;
  goodCount: number;
  rejectCount: number;
  operatingSec: number;
  runSec: number;
  /** E20 P20.5 (FAT-157): `*Pct` string-numeric nullable (§K 1163) — bukan 0. */
  availabilityPct: string | number | null;
  performancePct: string | number | null;
  qualityPct: string | number | null;
  oeePct: string | number | null;
  sampleCount: number;
  provisional: boolean;
}

export interface ReconciliationJob {
  job_id: string;
  name: string;
  view_name: string;
  schedule_interval: string;
  last_run: string;
  // E23 Batch 2 (FAT-191, N-22): `lastSuccessfulFinish` spec live
  // (null bila job belum pernah sukses) — dipertahankan terpisah dari
  // `last_run` (start terakhir) agar tidak hilang di mapper.
  last_successful_finish?: string;
  last_status: 'SUCCESS' | 'RUNNING' | 'FAILED';
  refresh_window_hours: number;
  records_processed: number;
}

export interface ReconciliationRefreshRequest {
  startWindow?: string;
  endWindow?: string;
  // E23 Batch 1 (FAT-177, N-8): spec live membalikkan keputusan E20
  // (R-11/T9/X29, `{from, to}` mengikuti api_docs §K.6) — body kanonis kini
  // `{startWindow, endWindow}`; alias lama `from`/`to` DIHAPUS (satu alur
  // kanonis). Anotasi keputusan di docs/API_SYNC_DIFF.md (R11/T9/X29).
}
