/**
 * Mapper backend→lokal — domain monitoring.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { num, str, bool, iso, pick, mustParse } from '../primitives';
import { TelemetryRollupItemSchema, TelemetryAggregatePointSchema } from '../../schemas';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';
import { timelineSegmentDurationMin } from '../../../../utils/historicalExport';
import { Shift } from '../../../../types/production';
import { LiveStateRecord, DowntimeEvent, OperationalEvent, DowntimeCategory, MachineFsmState } from '../../../../types/monitoring';
import { ShiftSummary, HourlyOeePoint, ShiftTimelineSegment, RejectParetoItem, TelemetryHistoryRecord, TelemetryRollupItem, ReconciliationJob, TelemetryAggregatePoint } from '../../../../types/analytics';
import { AuditLogItem } from '../../../../types/system';

export function mapLiveState(raw: unknown): LiveStateRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    device_id: str(pick(r.deviceId, r.device_id)),
    machine_id: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), ''),
    wo_id: (pick(r.woId, r.wo_id) as string | null) ?? null,
    fsm_state: normalizeFsmState(str(pick(r.currentState, r.fsm_state, r.state), 'UNCONFIGURED')) as MachineFsmState,
    oee: num(pick(r.oee), 0),
    availability: num(pick(r.availability), 0),
    performance: num(pick(r.performance), 0),
    quality: num(pick(r.quality), 0),
    total_count: num(pick(r.totalCount, r.total_count), 0),
    good_count: num(pick(r.goodCount, r.good_count), 0),
    reject_count: num(pick(r.rejectCount, r.reject_count), 0),
    last_cycle_time_sec: num(pick(r.lastCycleTimeSec, r.last_cycle_time_sec), 0) || undefined,
    operating_time_seconds: num(pick(r.operatingTimeSec, r.operating_time_sec, r.operatingTimeSeconds), 0),
    run_time_seconds: num(pick(r.runTimeSec, r.run_time_sec, r.runTimeSeconds), 0),
    downtime_seconds: num(pick(r.downtimeSec, r.downtime_sec, r.downtimeSeconds), 0),
    spindle_rpm: num(pick(r.spindleRpm, r.spindle_rpm), 0) || undefined,
    machine_temp_c: num(pick(r.machineTempC, r.machine_temp_c), 0) || undefined,
    plc_alarm_code: num(pick(r.plcAlarmCode, r.plc_alarm_code), 0) || undefined,
    uptime_seconds: num(pick(r.uptimeSeconds, r.uptime_seconds), 0) || undefined,
    free_heap_bytes: num(pick(r.freeHeapBytes, r.free_heap_bytes), 0) || undefined,
    active_work_order: (pick(r.woId, r.wo_id) as string | null) ?? null,
    active_product: null,
    last_telemetry_at: iso(pick(r.lastTelemetryAt, r.last_telemetry_at, r.updatedAt, r.updated_at)),
    updated_at: iso(pick(r.updatedAt, r.updated_at)),
    device_online: true,
  };
}

export function mapDowntime(raw: unknown): DowntimeEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  return {
    id: String(pick(r.id, r.eventId, r.event_id) ?? ''),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), ''),
    started_at: iso(pick(r.startTime, r.start_time, r.startedAt, r.started_at)),
    ended_at: (pick(r.endTime, r.end_time, r.endedAt, r.ended_at) as string | null) ?? null,
    duration_seconds: num(pick(r.durationSec, r.duration_seconds, r.durationSec), 0),
    durationFormatted: str(pick(r.durationFormatted, r.duration_formatted), undefined) || undefined,
    category: (pick(r.category) as DowntimeCategory) ?? 'OTHER',
    reason: str(pick(r.operatorReason, r.operator_reason, r.reason), ''),
    notes: str(pick(r.notes), undefined) || undefined,
    is_labeled: Boolean(pick(r.operatorReason, r.operator_reason, r.reason)),
    is_overwrite: bool(pick(r.isOverwrite, r.is_overwrite), false),
    acknowledged_by: str(pick(r.acknowledgedBy, r.acknowledged_by), undefined) || undefined,
    created_at: iso(pick(r.createdAt, r.created_at, r.startTime, r.start_time)),
  };
}

export function mapOperationalEvent(raw: unknown): OperationalEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  return {
    id: String(pick(r.id) ?? ''),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), 'Plant System'),
    event_type: (pick(r.eventType, r.event_type) as OperationalEvent['event_type']) ?? 'STATE_CHANGE',
    severity: (pick(r.severity) as OperationalEvent['severity']) ?? 'INFO',
    message: str(pick(r.message, r.details, r.eventType, r.event_type), ''),
    acknowledged: bool(pick(r.acknowledged, r.isAcknowledged), false),
    acknowledged_by: str(pick(r.acknowledgedBy, r.acknowledged_by), undefined) || undefined,
    acknowledged_at: str(pick(r.acknowledgedAt, r.acknowledged_at), undefined) || undefined,
    ack_note: str(pick(r.ackNote, r.ack_note, r.note), undefined) || undefined,
    timestamp: iso(pick(r.timestamp, r.createdAt, r.created_at)),
  };
}

export function mapAuditLog(raw: unknown): AuditLogItem {
  const ev = mapOperationalEvent(raw);
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: ev.id,
    timestamp: ev.timestamp,
    device_id: ev.device_id,
    machine_id: ev.machine_id ?? null,
    machine_name: ev.machine_name,
    operator_id: (pick(r.operatorId, r.operator_id) as string | null) ?? null,
    operator_name: str(pick(r.operatorName, r.operator_name), ''),
    event_type: ev.event_type,
    action: str(pick(r.action, r.eventType, r.event_type), ev.event_type),
    resource_type: (pick(r.resourceType, r.resource_type) as AuditLogItem['resource_type']) ?? 'SYSTEM',
    resource_id: str(pick(r.resourceId, r.resource_id, ev.id)),
    details: ev.message,
    client_ip: str(pick(r.clientIp, r.client_ip), ''),
    access_mode: (pick(r.accessMode, r.access_mode) as AuditLogItem['access_mode']) ?? 'LAN',
  };
}

export function mapTelemetryHistory(raw: unknown): TelemetryHistoryRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const total = num(pick(r.totalCount, r.total_count), 0);
  const good = num(pick(r.goodCount, r.good_count), 0);
  const reject = num(pick(r.rejectCount, r.reject_count), 0);
  return {
    id: String(pick(r.id, r.recordedAt, r.recorded_at) ?? `${pick(r.deviceId, r.device_id)}-${pick(r.recordedAt, r.recorded_at)}`),
    device_id: str(pick(r.deviceId, r.device_id)),
    timestamp: iso(pick(r.recordedAt, r.recorded_at, r.timestamp, r.bucket)),
    fsm_state: normalizeFsmState(str(pick(r.state, r.fsm_state), 'UNCONFIGURED')) as MachineFsmState,
    total_count: total,
    good_count: good,
    reject_count: reject,
    totalCount: total,
    goodCount: good,
    rejectCount: reject,
    operatingTimeSec: num(pick(r.operatingSec, r.operating_sec), 0) || undefined,
    runTimeSec: num(pick(r.runSec, r.run_sec), 0) || undefined,
    downtimeSec: num(pick(r.downtimeSec, r.downtime_sec), 0) || undefined,
    lastCycleTimeSec: num(pick(r.lastCycleTimeSec, r.last_cycle_time_sec), 0) || undefined,
    oee: num(pick(r.oeePct, r.oee), 0),
    availability: num(pick(r.availabilityPct, r.availability), 0),
    performance: num(pick(r.performancePct, r.performance), 0),
    quality: num(pick(r.qualityPct, r.quality), 0),
    // E12 T12.15 (F-11 / FAT-67): satuan cycle_time_ms ditentukan oleh NAMA
    // field, bukan urutan fallback — `cycleTimeMs`/`cycle_time_ms` SUDAH
    // milidetik (×1), `lastCycleTimeSec`/`last_cycle_time_sec` detik (×1000).
    // Hitungan lama `pick(cycleTimeMs, lastCycleTimeSec, last_cycle_time_sec)
    // × 1000` mengalikan nilai ms dengan 1000 bila server mengirim
    // cycleTimeMs → nilai di layar Raw 1000× lebih besar tanpa tanda apa pun
    // (G20). Prioritas: field ms dulu (tanpa konversi, paling cocok dengan
    // nama field target), lalu field detik. Layar Raw + CSV menampilkan
    // detik (`cycle_time_sec` = lastCycleTimeSec, fallback cycle_time_ms /
    // 1000) — konsisten dengan nilai ms yang benar di sini.
    cycle_time_ms: (() => {
      const ms = pick(r.cycleTimeMs, r.cycle_time_ms);
      if (ms !== undefined) return num(ms, 0);
      return num(pick(r.lastCycleTimeSec, r.last_cycle_time_sec), 0) * 1000;
    })(),
    temperature_c: num(pick(r.machineTempC, r.tempC, r.temperature_c), 0) || undefined,
    is_buffered: bool(pick(r.isBuffered, r.is_buffered), false),
  };
}

export function mapHourly(raw: unknown): HourlyOeePoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hour: str(pick(r.bucket, r.hour), ''),
    bucket: str(pick(r.bucket), undefined) || undefined,
    oee: num(pick(r.oeePct, r.oee), 0),
    availability: num(pick(r.availabilityPct, r.availability), 0),
    performance: num(pick(r.performancePct, r.performance), 0),
    quality: num(pick(r.qualityPct, r.quality), 0),
    parts_produced: num(pick(r.totalCount, r.total_count), 0),
    defect_count: num(pick(r.rejectCount, r.reject_count), 0),
    good_count: num(pick(r.goodCount, r.good_count), 0) || undefined,
    hourly_operating_sec: num(pick(r.operatingSec, r.operating_sec), 0) || undefined,
    hourly_run_sec: num(pick(r.runSec, r.run_sec), 0) || undefined,
    sampleCount: num(pick(r.sampleCount, r.sample_count), 0) || undefined,
    // E12 T12.3 (F-6): pertahankan null (kapasitas unknown) — `pick`
    // membuang null sehingga sinyal kapasitas 0/unknown dari server hilang;
    // tabel per jam memakai targetPerHour null/0 untuk menampilkan
    // "— (Kapasitas 0/Unknown)" seperti rollup. Tanpa field dari server →
    // undefined (nilai tampil apa adanya).
    targetPerHour: (r.targetPerHour !== undefined ? r.targetPerHour : r.target_per_hour) as number | null | undefined,
    state: (pick(r.state) as MachineFsmState | null) ?? undefined,
    planned: bool(pick(r.planned), false),
    provisional: bool(pick(r.provisional), false),
  };
}

/**
 * E12 T12.2 (F-5 / FAT-51): satu baris agregat per bucket — dipakai
 * getTelemetryAggregate untuk SELURUH rows, bukan hanya rows[0].
 * Menerima field kanonis API doc §K.4/§Q (`oeePct`, `totalCount`, …) plus
 * alias legacy/snake_case dan bentuk ringkasan lama (`avg_oee`,
 * `total_parts`, `sample_count`) agar respons lama tetap termuat.
 */
export function mapAggregate(raw: unknown): TelemetryAggregatePoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  // API doc §Q: good = max(0, output − reject) bila tidak dikirim eksplisit.
  const totalCount = num(pick(r.totalCount, r.total_count, r.total_parts, r.totalParts), 0);
  const rejectCount = num(pick(r.rejectCount, r.reject_count), 0);
  const item = {
    bucket: str(pick(r.bucket, r.bucket_start, r.bucketStart, r.hour), ''),
    totalCount,
    goodCount: num(pick(r.goodCount, r.good_count), Math.max(0, totalCount - rejectCount)),
    rejectCount,
    operatingSec: num(pick(r.operatingSec, r.operating_sec), 0),
    runSec: num(pick(r.runSec, r.run_sec), 0),
    availabilityPct: pick(r.availabilityPct, r.availability_pct, r.avg_availability, r.availability, 0) as string | number,
    performancePct: (pick(r.performancePct, r.performance_pct, r.avg_performance, r.performance) as string | number | null) ?? null,
    qualityPct: pick(r.qualityPct, r.quality_pct, r.avg_quality, r.quality, 0) as string | number,
    oeePct: pick(r.oeePct, r.oee_pct, r.avg_oee, r.oee, 0) as string | number,
    sampleCount: num(pick(r.sampleCount, r.sample_count), 0),
    provisional: bool(pick(r.provisional), false),
  };
  return mustParse(TelemetryAggregatePointSchema, item, 'agregat telemetri');
}

export function mapRollup(raw: unknown): TelemetryRollupItem {  const r = (raw ?? {}) as Record<string, unknown>;
  const item = {
    groupBy: (pick(r.groupBy, r.group_by) as TelemetryRollupItem['groupBy']) ?? 'day',
    groupKey: str(pick(r.groupKey, r.machineId, r.machine_id, r.deviceId, r.device_id, r.bucket), 'row'),
    bucket: (pick(r.bucket) as string | null) ?? null,
    machineId: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_id: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_name: (pick(r.machineName, r.machine_name) as string | null) ?? null,
    device_id: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    totalCount: num(pick(r.totalCount, r.total_count), 0),
    goodCount: num(pick(r.goodCount, r.good_count), 0),
    rejectCount: num(pick(r.rejectCount, r.reject_count), 0),
    operatingSec: num(pick(r.operatingSec, r.operating_sec), 0),
    runSec: num(pick(r.runSec, r.run_sec), 0),
    availabilityPct: pick(r.availabilityPct, r.availability_pct, 0) as string | number,
    performancePct: (pick(r.performancePct, r.performance_pct) as string | number | null) ?? null,
    qualityPct: pick(r.qualityPct, r.quality_pct, 0) as string | number,
    oeePct: pick(r.oeePct, r.oee_pct, 0) as string | number,
    sampleCount: num(pick(r.sampleCount, r.sample_count), 0),
    provisional: bool(pick(r.provisional), false),
  };
  return mustParse(TelemetryRollupItemSchema, item, 'rollup OEE');
}

export function mapReject(raw: unknown, runningTotal: { total: number; cumulative: number }): RejectParetoItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  const count = num(pick(r.count), 0);
  const pct = num(pick(r.pct, r.percentage), 0);
  runningTotal.cumulative += pct;
  return {
    reason: str(pick(r.reason), 'UNCLASSIFIED'),
    count,
    pct,
    percentage: pct,
    cumulative_percentage: Math.min(100, Math.round(runningTotal.cumulative * 10) / 10),
  };
}

export function mapShiftSummary(raw: unknown, machineId?: string): ShiftSummary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const time = (r.time_sec ?? r.timeSec ?? {}) as Record<string, unknown>;
  const win = (r.window ?? {}) as Record<string, unknown>;
  const operatingSec = num(pick(time.operating, time.operatingSec), 0);
  const runSec = num(pick(time.run, time.runSec), 0);
  const downtimeSec = num(pick(time.downtime, time.downtimeSec), 0);
  // E12 T12.4 (F-7 / FAT-55): planned downtime dibaca dari field-nya sendiri
  // bila server mengirimnya (API doc §Q.1 / TELEMETRY_AUDIT F-7:
  // `time_sec.planned`), bukan hardcode 0. Alias detik dulu (kanonis
  // `time_sec.*`), lalu alias menit (`planned_downtime_min`). Bila tidak
  // dikirim sama sekali → fallback 0 seperti sebelumnya. Panel HANYA membaca
  // field ini; definisi availability untuk jam planned penuh (G8 sisi server)
  // tetap keputusan backend/CAgg — panel tidak menghitung ulang OEE di klien
  // (Build Guide §14.3).
  const plannedDowntimeSec = pick(time.planned, time.plannedSec, time.plannedDowntimeSec, time.planned_downtime_sec);
  const plannedDowntimeMinRaw = pick(r.planned_downtime_min, r.plannedDowntimeMin, time.plannedDowntimeMin, time.planned_downtime_min);
  const plannedDowntimeMin = plannedDowntimeSec !== undefined
    ? Math.round(num(plannedDowntimeSec) / 60)
    : plannedDowntimeMinRaw !== undefined
      ? Math.round(num(plannedDowntimeMinRaw))
      : 0;
  // E12 T12.4 (F-7 / FAT-55): planned production time dari field-nya sendiri
  // bila dikirim server (`time_sec.planned_production`, atau
  // `planned_operating_sec` — nama yang dipakai API doc untuk konsep yang
  // sama di shift_plan WO resolve — atau `planned_production_time_min`
  // beserta alias camelCase/snake_case-nya), bukan dari `operatingSec`.
  // Bila tidak dikirim → fallback perilaku lama (`operatingSec` / 60) agar
  // angka yang sudah ada tidak berubah.
  const plannedProductionSec = pick(
    time.planned_production, time.plannedProductionSec, time.planned_production_sec,
    time.plannedOperatingSec, time.planned_operating_sec,
    r.planned_operating_sec, r.plannedOperatingSec,
  );
  const plannedProductionMinRaw = pick(
    r.planned_production_time_min, r.plannedProductionTimeMin,
    time.plannedProductionTimeMin, time.planned_production_time_min,
  );
  const plannedProductionTimeMin = plannedProductionSec !== undefined
    ? Math.round(num(plannedProductionSec) / 60)
    : plannedProductionMinRaw !== undefined
      ? Math.round(num(plannedProductionMinRaw))
      : Math.round(operatingSec / 60);
  return {
    shift_name: str(pick(r.shift_name, r.shiftName, r.shift), 'Shift'),
    machine_id: str(pick(r.machine_id, r.machineId, machineId), ''),
    machine_name: str(pick(r.machine_name, r.machineName), ''),
    shift_start: iso(pick(win.from, r.shift_start, r.from)),
    shift_end: iso(pick(win.to, r.shift_end, r.to)),
    tz: str(pick(win.tz, r.tz), undefined) || undefined,
    oee: num(pick(r.oee), 0),
    availability: num(pick(r.availability), 0),
    performance: num(pick(r.performance), 0),
    quality: num(pick(r.quality), 0),
    planned_production_time_min: plannedProductionTimeMin,
    planned_break_min: num(pick(r.planned_break_min), 0) || undefined,
    operating_time_min: Math.round(operatingSec / 60),
    run_time_min: Math.round(runSec / 60),
    unplanned_downtime_min: Math.round(downtimeSec / 60),
    planned_downtime_min: plannedDowntimeMin,
    total_parts: num(pick(r.totalCount, r.total_count), 0),
    good_parts: num(pick(r.goodCount, r.good_count), 0),
    defect_parts: num(pick(r.rejectCount, r.reject_count), 0),
    target_per_hour: (pick(r.target_per_hour, r.targetPerHour) as number | null) ?? null,
  };
}

export function mapTimelineSegment(raw: unknown): ShiftTimelineSegment {
  const r = (raw ?? {}) as Record<string, unknown>;
  const start = iso(pick(r.start));
  const end = iso(pick(r.end));
  return {
    start,
    end,
    fsm_state: normalizeFsmState(str(pick(r.state), 'UNCONFIGURED')) as MachineFsmState,
    planned: bool(pick(r.planned), false),
    downtime_id: (pick(r.downtime_id, r.downtimeId) as string | null) ?? (pick(r.downtime_id) !== undefined ? String(pick(r.downtime_id)) : null),
    // E12 T12.11 (X-4 / FAT-59): durasi benar untuk ISO 8601 (Real/demo
    // baru) MAUPUN 'HH:MM' polos (format demo lama) — `Date.parse('HH:MM')`
    // = NaN sehingga hitungan lama menghasilkan NaN di sini.
    duration_min: timelineSegmentDurationMin(start, end),
  };
}

export function mapReconciliationJob(raw: unknown): ReconciliationJob {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    job_id: str(pick(r.job_id, r.jobId)),
    name: str(pick(r.name)),
    view_name: str(pick(r.view_name, r.viewName)),
    schedule_interval: str(pick(r.schedule_interval, r.scheduleInterval)),
    last_run: iso(pick(r.last_run, r.lastRun)),
    last_status: (pick(r.last_status, r.lastStatus, 'SUCCESS') as ReconciliationJob['last_status']),
    refresh_window_hours: num(pick(r.refresh_window_hours, r.refreshWindowHours), 0),
    records_processed: num(pick(r.records_processed, r.recordsProcessed), 0),
  };
}
