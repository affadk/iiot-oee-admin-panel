/**
 * Method demo — domain OEE.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Shift summary, timeline shift, OEE per jam, hourly trend,
 * dan aggregate. getOeeHourly memanggil getHourlyTrend lokal
 * (objek domain yang sama).
 */

import { store } from '../store';
import { checkAbort, throwValidationIssues } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { ShiftSummary, HourlyOeePoint, ShiftTimelineSegment, TelemetryRangeOptions } from '../../../../types/analytics';
import { parseIsoDateAndOffset, rebucketTimelineSegments, CANONICAL_SHIFT_SEGMENTS } from './helpers';

export const demoTelemetryOee = {
  async getShiftSummary(
    machineId?: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftSummary> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (machineId) qs.set('machine_id', machineId);
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    const qStr = qs.toString();
    store.recordEndpoint('OEE_SHIFT_SUMMARY', `${ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const targetMachine = store.machines.find((m) => m.machine_id === machineId) || store.machines[0];
    const live = store.liveStates.find((l) => l.machine_id === targetMachine?.machine_id);
    // E11 T11.2 (F-2): hormati rentang from/to — seed demo adalah satu shift
    // (07:00–15:00); jendela shift diproyeksikan ke tanggal kalender `to`
    // (fallback `from`), mengikuti pola anchor T11.1 pada hourly. Angka-angka
    // shift tidak berubah; tanpa from/to, jendela tetap 2026-11-11 seperti
    // sebelumnya.
    const anchor = (options?.to ? parseIsoDateAndOffset(options.to) : null)
      ?? (options?.from ? parseIsoDateAndOffset(options.from) : null);
    const shiftDate = anchor?.date ?? '2026-11-11';
    const shiftOffset = anchor?.offset || '+07:00';
    return {
      shift_name: 'Shift 1 (07:00-15:00)',
      machine_id: targetMachine?.machine_id || 'CNC-MILLING-01',
      machine_name: targetMachine?.name || 'CNC Milling Center Alpha',
      shift_start: `${shiftDate}T07:00:00${shiftOffset}`,
      shift_end: `${shiftDate}T15:00:00${shiftOffset}`,
      tz: 'Asia/Jakarta',
      oee: live?.oee ?? 84.6,
      availability: live?.availability ?? 92.4,
      performance: live?.performance ?? 94.1,
      quality: live?.quality ?? 97.4,
      planned_production_time_min: 480,
      planned_break_min: 60,
      operating_time_min: 420,
      run_time_min: 388,
      unplanned_downtime_min: 32,
      planned_downtime_min: 60,
      total_parts: live?.total_count ?? 350,
      good_parts: live?.good_count ?? 342,
      defect_parts: live?.reject_count ?? 8,
      target_per_hour: 64,
    };
  },

  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftTimelineSegment[]> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (machineId) qs.set('machine_id', machineId);
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    store.recordEndpoint('OEE_SHIFT_TIMELINE', `${ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath()}?${qs.toString()}`);
    // E11 T11.4 (F-4): segmen kanonis (5) dipecah eksak per bucket yang
    // diminta — Σ per state tetap 388/60/32 pada semua bucket.
    const segments = rebucketTimelineSegments(CANONICAL_SHIFT_SEGMENTS, bucket);
    // E11 T11.2 (F-2): hormati rentang from/to — segmen diproyeksikan ke
    // tanggal kalender `to` (fallback `from`), mengikuti pola anchor T11.1,
    // lalu hanya segmen yang bersinggungan dengan rentang yang dikembalikan
    // (batas inklusif, sama seperti bucket hourly). Tanpa from/to, segmen
    // hasil re-bucket (E11 T11.4) dikembalikan seperti sebelumnya.
    // Segmen tidak dipotong.
    if (!options?.from && !options?.to) return segments;
    const anchor = (options?.to ? parseIsoDateAndOffset(options.to) : null)
      ?? (options?.from ? parseIsoDateAndOffset(options.from) : null);
    if (!anchor) return segments;
    const fromMs = options?.from ? Date.parse(options.from) : NaN;
    const toMs = options?.to ? Date.parse(options.to) : NaN;
    return segments.filter((seg) => {
      const segStartMs = Date.parse(`${anchor.date}T${seg.start}:00${anchor.offset}`);
      const segEndMs = Date.parse(`${anchor.date}T${seg.end}:00${anchor.offset}`);
      if (Number.isNaN(segStartMs) || Number.isNaN(segEndMs)) return true;
      if (!Number.isNaN(fromMs) && segEndMs < fromMs) return false;
      if (!Number.isNaN(toMs) && segStartMs > toMs) return false;
      return true;
    });
  },

  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (params.machine_id) qs.set('machine_id', params.machine_id);
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    const qStr = qs.toString();
    store.recordEndpoint('OEE_HOURLY', `${ADMIN_ENDPOINTS.OEE_HOURLY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const devId =
      params.device_id ||
      store.machines.find((m) => m.machine_id === params.machine_id)?.bound_device_id ||
      'STM32-OEE-01';
    return demoTelemetryOee.getHourlyTrend(devId, signal);
  },

  async getHourlyTrend(
    deviceId: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    if (!deviceId) {
      throwValidationIssues('device_id wajib disediakan.', { device_id: 'Wajib dipilih.' });
    }
    const qs = new URLSearchParams();
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    if (options?.limit !== undefined) qs.set('limit', String(options.limit));
    const qStr = qs.toString();
    store.recordEndpoint('TELEMETRY_HOURLY', `${ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId)}${qStr ? `?${qStr}` : ''}`);
    const isUnknownCapacity = deviceId === 'STM32-OEE-05';
    const points: HourlyOeePoint[] = [
      // E11 T11.4 (F-4): jam 07:00 — micro-stop 432 dtk → 350 dtk
      // (run 3168 → 3250 dtk) supaya Σ hourly_run_sec = 23.280 dtk
      // (388 mnt = run_time_min) dan Σ downtime = 92 mnt. availability
      // = 3250/3600 = 90,3%; oee = 90,3 × 91,0 × 98,0 / 10000 = 80,5.
      // Jam 12:00 TIDAK diubah (sepenuhnya planned — gap G8, urusan backend).
      { hour: '07:00', oee: isUnknownCapacity ? 0 : 80.5, availability: isUnknownCapacity ? 100 : 90.3, performance: isUnknownCapacity ? 0 : 91.0, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 42, good_count: isUnknownCapacity ? 0 : 41, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3250, hourly_downtime_sec: 350, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '08:00', oee: isUnknownCapacity ? 0 : 84.6, availability: isUnknownCapacity ? 100 : 92.4, performance: isUnknownCapacity ? 0 : 94.1, quality: isUnknownCapacity ? 100 : 97.4, parts_produced: isUnknownCapacity ? 0 : 48, good_count: isUnknownCapacity ? 0 : 47, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3326, hourly_downtime_sec: 274, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '09:00', oee: isUnknownCapacity ? 0 : 86.2, availability: isUnknownCapacity ? 100 : 94.0, performance: isUnknownCapacity ? 0 : 93.5, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 50, good_count: isUnknownCapacity ? 0 : 49, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3384, hourly_downtime_sec: 216, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '10:00', oee: isUnknownCapacity ? 0 : 82.0, availability: isUnknownCapacity ? 100 : 90.0, performance: isUnknownCapacity ? 0 : 92.0, quality: isUnknownCapacity ? 100 : 99.0, parts_produced: isUnknownCapacity ? 0 : 46, good_count: isUnknownCapacity ? 0 : 46, defect_count: 0, hourly_operating_sec: 3600, hourly_run_sec: 3240, hourly_downtime_sec: 360, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '11:00', oee: isUnknownCapacity ? 0 : 85.5, availability: isUnknownCapacity ? 100 : 93.0, performance: isUnknownCapacity ? 0 : 94.0, quality: isUnknownCapacity ? 100 : 97.8, parts_produced: isUnknownCapacity ? 0 : 49, good_count: isUnknownCapacity ? 0 : 48, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3348, hourly_downtime_sec: 252, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '12:00', oee: 0.0, availability: 0.0, performance: 0.0, quality: 100.0, parts_produced: 0, good_count: 0, defect_count: 0, hourly_operating_sec: 0, hourly_run_sec: 0, hourly_downtime_sec: 3600, sampleCount: 12, targetPerHour: 0, state: 'PLANNED_DOWNTIME', planned: true, provisional: false },
      { hour: '13:00', oee: isUnknownCapacity ? 0 : 87.8, availability: isUnknownCapacity ? 100 : 95.0, performance: isUnknownCapacity ? 0 : 94.5, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 52, good_count: isUnknownCapacity ? 0 : 51, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3420, hourly_downtime_sec: 180, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
      { hour: '14:00', oee: isUnknownCapacity ? 0 : 84.0, availability: isUnknownCapacity ? 100 : 92.0, performance: isUnknownCapacity ? 0 : 93.0, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 47, good_count: isUnknownCapacity ? 0 : 46, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3312, hourly_downtime_sec: 288, sampleCount: 44, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
    ];

    // E11 T11.1 (F-1): hormati rentang from/to — seed demo adalah satu hari
    // shift (07:00–14:00); proyeksikan tiap bucket ke tanggal kalender `to`
    // (fallback `from`) lalu buang bucket di luar rentang. Tanpa from/to,
    // kedelapan bucket dikembalikan seperti sebelumnya.
    let filtered = points;
    if (options?.from || options?.to) {
      const anchor = (options?.to ? parseIsoDateAndOffset(options.to) : null)
        ?? (options?.from ? parseIsoDateAndOffset(options.from) : null);
      if (anchor) {
        const fromMs = options?.from ? Date.parse(options.from) : NaN;
        const toMs = options?.to ? Date.parse(options.to) : NaN;
        filtered = points.filter((p) => {
          const bucketMs = Date.parse(`${anchor.date}T${p.hour}:00${anchor.offset}`);
          if (Number.isNaN(bucketMs)) return true;
          if (!Number.isNaN(fromMs) && bucketMs < fromMs) return false;
          if (!Number.isNaN(toMs) && bucketMs > toMs) return false;
          return true;
        });
      }
    }
    // Server mengembalikan "N bucket terakhir" bila limit diminta.
    if (options?.limit !== undefined && Number.isFinite(options.limit)) {
      const n = Math.max(0, Math.floor(options.limit));
      filtered = filtered.slice(Math.max(0, filtered.length - n));
    }
    return filtered;
  },

  async getTelemetryAggregate(
    deviceId: string,
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<{
    device_id: string;
    bucket: string;
    avg_oee: number;
    avg_availability: number;
    avg_performance: number;
    avg_quality: number;
    total_parts: number;
    sample_count: number;
  }> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    if (options?.limit !== undefined) qs.set('limit', String(options.limit));
    store.recordEndpoint(
      'TELEMETRY_AGGREGATE',
      `${ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId)}?${qs.toString()}`
    );
    const mult = bucket === '1m' ? 12 : bucket === '5m' ? 36 : bucket === '15m' ? 108 : bucket === '1h' ? 432 : 1850;
    // E11 T11.1 (F-1): hormati rentang from/to — jumlah sampel/parts diskalakan
    // sebanding dengan panjang rentang terhadap jendela default 7 hari;
    // rata-rata (avg_*) tidak bergantung pada panjang rentang. Tanpa from/to
    // yang valid, nilai sama seperti sebelumnya (rasio 1).
    const DEFAULT_WINDOW_MS = 7 * 24 * 3600_000;
    let ratio = 1;
    const fromMs = options?.from ? Date.parse(options.from) : NaN;
    const toMs = options?.to ? Date.parse(options.to) : NaN;
    if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
      ratio = Math.max(0, (toMs - fromMs) / DEFAULT_WINDOW_MS);
    }
    return {
      device_id: deviceId,
      bucket,
      avg_oee: deviceId === 'STM32-OEE-05' ? 0 : 83.5,
      avg_availability: deviceId === 'STM32-OEE-05' ? 100 : 91.4,
      avg_performance: deviceId === 'STM32-OEE-05' ? 0 : 93.1,
      avg_quality: deviceId === 'STM32-OEE-05' ? 100 : 98.0,
      total_parts: deviceId === 'STM32-OEE-05' ? 0 : Math.round(mult * 0.77 * ratio),
      sample_count: Math.round(mult * ratio),
    };
  },
};
