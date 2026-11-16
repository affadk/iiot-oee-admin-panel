import { MachineFsmState } from './monitoring';

export interface ShiftSummary {
  shift_name: string;
  machine_id: string;
  machine_name: string;
  shift_start: string;
  shift_end: string;
  tz?: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  planned_production_time_min: number;
  planned_break_min?: number;
  operating_time_min: number;
  run_time_min: number;
  unplanned_downtime_min: number;
  planned_downtime_min: number;
  total_parts: number;
  good_parts: number;
  defect_parts: number;
  target_per_hour?: number | null;
}

export interface HourlyOeePoint {
  hour: string;
  bucket?: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  parts_produced: number;
  defect_count: number;
  good_count?: number;
  hourly_operating_sec?: number;
  hourly_run_sec?: number;
  hourly_downtime_sec?: number;
  sampleCount?: number;
  targetPerHour?: number | null;
  state?: MachineFsmState | null;
  planned?: boolean;
  provisional?: boolean;
}

/**
 * Rentang waktu (+ limit) untuk query telemetry per jam / agregat.
 * Dipakai konsisten oleh mode Demo dan Real (E11 T11.1 / F-1): tanpa
 * options, perilaku sama seperti sebelumnya (default server/demo).
 */
export interface TelemetryRangeOptions {
  from?: string;
  to?: string;
  limit?: number;
}

export interface TelemetryAggregatePoint {
  bucket: string;
  totalCount: number;
  goodCount: number;
  rejectCount: number;
  operatingSec: number;
  runSec: number;
  availabilityPct: string | number;
  performancePct: string | number | null;
  qualityPct: string | number;
  oeePct: string | number;
  sampleCount: number;
  provisional: boolean;
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

export type TelemetryRollupGroupBy = 'machine' | 'day' | 'month';

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
  totalCount: number;
  goodCount: number;
  rejectCount: number;
  operatingSec: number;
  runSec: number;
  availabilityPct: string | number;
  performancePct: string | number | null;
  qualityPct: string | number;
  oeePct: string | number;
  sampleCount: number;
  provisional: boolean;
}

export interface ReconciliationJob {
  job_id: string;
  name: string;
  view_name: string;
  schedule_interval: string;
  last_run: string;
  last_status: 'SUCCESS' | 'RUNNING' | 'FAILED';
  refresh_window_hours: number;
  records_processed: number;
}

export interface ReconciliationRefreshRequest {
  from?: string;
  to?: string;
  startWindow?: string;
  endWindow?: string;
}
