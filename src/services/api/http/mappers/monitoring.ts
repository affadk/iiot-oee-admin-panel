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

/**
 * E20 P20.5 (FAT-157): `device_online` BUKAN hardcode `true` — dibaca bila
 * server mengirim `isOnline`/`device_online`, bila tidak diturunkan dari
 * proyeksi TTL atas `lastTelemetryAt`/`updatedAt` (§7E,
 * `DEVICE_PRESENCE_TTL_SEC=300`); live-state sendiri tidak membawa
 * `isOnline`. Tanpa timestamp yang bisa diproyeksikan → offline (false).
 * Field `spindleRpm`/`machineTempC`/`plcAlarmCode` DIHAPUS — tidak ada di
 * respons §B; nilai PLC itu datang lewat WS `plc_modbus` (§7A), bukan
 * dari snapshot live-state HTTP.
 */
export function mapLiveState(raw: unknown): LiveStateRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lastTelemetryAt = iso(pick(r.lastTelemetryAt, r.last_telemetry_at, r.updatedAt, r.updated_at));
  const updatedAt = iso(pick(r.updatedAt, r.updated_at));
  const onlineFlag = pick(r.isOnline, r.device_online);
  const deviceOnline =
    typeof onlineFlag === 'boolean'
      ? onlineFlag
      : (() => {
          const tsMs = Date.parse(lastTelemetryAt) || Date.parse(updatedAt);
          if (!Number.isFinite(tsMs) || tsMs <= 0) return false;
          return Date.now() - tsMs <= 300_000;
        })();
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
    uptime_seconds: num(pick(r.uptimeSeconds, r.uptime_seconds), 0) || undefined,
    free_heap_bytes: num(pick(r.freeHeapBytes, r.free_heap_bytes), 0) || undefined,
    active_work_order: (pick(r.woId, r.wo_id) as string | null) ?? null,
    active_product: null,
    last_telemetry_at: lastTelemetryAt,
    updated_at: updatedAt,
    device_online: deviceOnline,
  };
}

export function mapDowntime(raw: unknown): DowntimeEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  // E23 Batch 3 (FAT-194, N-25): spec live TIDAK punya `category` pada
  // item downtime — nilai yang dikirim server dipakai bila ada (bentuk
  // demo/legacy), bila tidak → 'UNKNOWN' (penanda lokal "tidak ada dari
  // server"), BUKAN 'OTHER' (nilai kategori POST /reason yang sah).
  // `isLabeled` spec dibaca langsung (dulu diturunkan dari ada/tidaknya
  // reason); `reason` ← `operatorReason` kanonis spec.
  const rawCategory = pick(r.category) as DowntimeCategory | undefined;
  const validCategories: DowntimeCategory[] = [
    'EQUIPMENT_FAILURE', 'SETUP_AND_ADJUSTMENT', 'IDLING_AND_MINOR_STOPPAGE',
    'REDUCED_SPEED', 'PROCESS_DEFECT', 'MATERIAL_SHORTAGE',
    'PLANNED_MAINTENANCE', 'REST_BREAK', 'CLEANING_5S', 'OTHER', 'UNKNOWN',
  ];
  const reason = str(pick(r.operatorReason, r.operator_reason, r.reason), '');
  const isLabeledRaw = pick(r.isLabeled, r.is_labeled);
  return {
    id: String(pick(r.id, r.eventId, r.event_id) ?? ''),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), ''),
    started_at: iso(pick(r.startTime, r.start_time, r.startedAt, r.started_at)),
    ended_at: (pick(r.endTime, r.end_time, r.endedAt, r.ended_at) as string | null) ?? null,
    // E20 P20.5 (FAT-157): sumber kebenaran durasi adalah `duration_sec`
    // (§7B/D1) — dibaca PERTAMA; alias lain hanya fallback.
    duration_seconds: num(pick(r.duration_sec, r.durationSec, r.duration_seconds), 0),
    durationFormatted: str(pick(r.durationFormatted, r.duration_formatted), undefined) || undefined,
    category: rawCategory !== undefined && validCategories.includes(rawCategory) ? rawCategory : 'UNKNOWN',
    reason,
    notes: str(pick(r.notes), undefined) || undefined,
    is_labeled: typeof isLabeledRaw === 'boolean' ? isLabeledRaw : Boolean(reason),
    is_overwrite: bool(pick(r.isOverwrite, r.is_overwrite), false),
    acknowledged_by: str(pick(r.acknowledgedBy, r.acknowledged_by), undefined) || undefined,
    created_at: iso(pick(r.createdAt, r.created_at, r.startTime, r.start_time)),
  };
}

/**
 * E20 P20.4 (FAT-156): `OperationalEventItem` FR-034-01 persis (API doc §I).
 * - `acknowledged` DITURUNKAN dari `acknowledgedAt` (bukan dibaca dari field).
 * - `machineName` null bila mesin dihapus (jangan default 'Plant System').
 * - Baca `description` + `recordedAt`; `snapshotTotalCount`/`snapshotRunSec`
 *   dibuang bila tak ada (null) — jangan dikarang. Tidak ada `severity`.
 * - `event_type` diteruskan apa adanya (enum tertutup + pola); bila absen
 *   kosong — jangan default ke nilai tebakan ('STATE_CHANGE' dihapus).
 * - `recorded_at`/`created_at` kosong ('') bila tak ada — jangan isi epoch
 *   (primitif `iso()` mengarang 1970-01-01).
 * - E27 (FAT-233, T2): `station_label` dibaca TOLERAN (camelCase/snake_case)
 *   — event lama tanpa field ini → null, tidak throw. Nilai mentah dari
 *   klien (UNTRUSTED): tampilkan apa adanya, jangan jadikan key/lookup.
 */
export function mapOperationalEvent(raw: unknown): OperationalEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const deviceId = pick(r.deviceId, r.device_id);
  const machineId = pick(r.machineId, r.machine_id);
  const machineName = pick(r.machineName, r.machine_name);
  const recordedAt = pick(r.recordedAt, r.recorded_at);
  const createdAt = pick(r.createdAt, r.created_at);
  const acknowledgedAt = pick(r.acknowledgedAt, r.acknowledged_at);
  const strOrEmpty = (v: unknown): string => (typeof v === 'string' ? v : '');
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const numOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    id: String(pick(r.id) ?? ''),
    recorded_at: strOrEmpty(recordedAt),
    device_id: deviceId === '[deleted]' ? null : (deviceId as string | null) ?? null,
    station_label: strOrNull(pick(r.stationLabel, r.station_label)),
    machine_id: machineId === '[deleted]' ? null : (machineId as string | null) ?? null,
    machine_name: machineName === '[deleted]' ? null : (machineName as string | null) ?? null,
    wo_id: (pick(r.woId, r.wo_id) as string | null) ?? null,
    event_type: (pick(r.eventType, r.event_type) as OperationalEvent['event_type']) ?? ('' as OperationalEvent['event_type']),
    trigger_source: strOrNull(pick(r.triggerSource, r.trigger_source)),
    event_code: numOrNull(pick(r.eventCode, r.event_code)),
    snapshot_total_count: numOrNull(pick(r.snapshotTotalCount, r.snapshot_total_count)),
    snapshot_run_sec: numOrNull(pick(r.snapshotRunSec, r.snapshot_run_sec)),
    description: str(pick(r.description), ''),
    acknowledged: acknowledgedAt !== undefined && acknowledgedAt !== null,
    acknowledged_at: strOrNull(acknowledgedAt),
    acknowledged_by: strOrNull(pick(r.acknowledgedBy, r.acknowledged_by)),
    ack_note: strOrNull(pick(r.ackNote, r.ack_note, r.note)),
    created_at: strOrEmpty(createdAt ?? recordedAt),
  };
}

/**
 * E20 P20.4 (FAT-156): `/system/audit` adalah alias audit trail global yang
 * mengembalikan `OperationalEventItem[]` (API doc §I) — tidak ada field
 * karangan (`operator_id`/`operator_name`, `action`, `resource_type`,
 * `resource_id`, `client_ip`, `access_mode`). Mapper audit = mapper
 * operational-event, tanpa tambahan apa pun.
 */
export function mapAuditLog(raw: unknown): AuditLogItem {
  return mapOperationalEvent(raw);
}

export function mapTelemetryHistory(raw: unknown): TelemetryHistoryRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const total = num(pick(r.totalCount, r.total_count), 0);
  const good = num(pick(r.goodCount, r.good_count), 0);
  const reject = num(pick(r.rejectCount, r.reject_count), 0);
  // E23 Batch 2 (FAT-190, N-21): spec live membawa `currentState`,
  // `operatingTimeSec`, `runTimeSec`, `actualCycleTimeSec` (string detik,
  // nullable) — keempatnya dulu dilewatkan mapper (fsm_state selalu
  // 'UNCONFIGURED', cycle_time_ms 0). Alias lama tetap fallback.
  const cycleSec = pick(r.actualCycleTimeSec, r.actual_cycle_time_sec, r.lastCycleTimeSec, r.last_cycle_time_sec);
  const lastCycleSec = cycleSec !== undefined ? num(cycleSec, 0) : undefined;
  return {
    id: String(pick(r.id, r.recordedAt, r.recorded_at) ?? `${pick(r.deviceId, r.device_id)}-${pick(r.recordedAt, r.recorded_at)}`),
    device_id: str(pick(r.deviceId, r.device_id)),
    timestamp: iso(pick(r.recordedAt, r.recorded_at, r.timestamp, r.bucket)),
    fsm_state: normalizeFsmState(str(pick(r.currentState, r.state, r.fsm_state), 'UNCONFIGURED')) as MachineFsmState,
    total_count: total,
    good_count: good,
    reject_count: reject,
    totalCount: total,
    goodCount: good,
    rejectCount: reject,
    operatingTimeSec: num(pick(r.operatingTimeSec, r.operating_time_sec, r.operatingSec, r.operating_sec), 0) || undefined,
    runTimeSec: num(pick(r.runTimeSec, r.run_time_sec, r.runSec, r.run_sec), 0) || undefined,
    downtimeSec: num(pick(r.downtimeSec, r.downtime_sec), 0) || undefined,
    lastCycleTimeSec: lastCycleSec || undefined,
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
    // E23 Batch 2 (FAT-190, N-21): sumber detik kanonis spec live adalah
    // `actualCycleTimeSec` (string, nullable) — didahulukan atas alias
    // lama `lastCycleTimeSec`.
    cycle_time_ms: (() => {
      const ms = pick(r.cycleTimeMs, r.cycle_time_ms);
      if (ms !== undefined) return num(ms, 0);
      return num(pick(r.actualCycleTimeSec, r.actual_cycle_time_sec, r.lastCycleTimeSec, r.last_cycle_time_sec), 0) * 1000;
    })(),
    temperature_c: num(pick(r.machineTempC, r.tempC, r.temperature_c), 0) || undefined,
    is_buffered: bool(pick(r.isBuffered, r.is_buffered), false),
  };
}

/**
 * E20 P20.5 (FAT-157): `*Pct` nullable dipertahankan — `pick` membuang
 * `null`, jadi baca langsung dari field (bukan lewat `pick` + `num(..., 0)`).
 * Absen → `null` (unknown); string-numeric ("92.50") diparse ke number.
 * D-8: `oee` null saat kapasitas unknown, bukan 0.
 */
function pctOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v === undefined) continue;
    if (v === null) return null;
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapHourly(raw: unknown): HourlyOeePoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hour: str(pick(r.bucket, r.hour), ''),
    bucket: str(pick(r.bucket), undefined) || undefined,
    oee: pctOrNull(r.oeePct, r.oee),
    availability: pctOrNull(r.availabilityPct, r.availability),
    performance: pctOrNull(r.performancePct, r.performance),
    quality: pctOrNull(r.qualityPct, r.quality),
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
    deviceId: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    machineId: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    woId: (pick(r.woId, r.wo_id) as string | null) ?? null,
  };
}

/**
 * E12 T12.2 (F-5 / FAT-51): satu baris agregat per bucket — dipakai
 * getTelemetryAggregate untuk SELURUH rows, bukan hanya rows[0].
 * Menerima field kanonis API doc §K.4/§Q (`oeePct`, `totalCount`, …) plus
 * alias legacy/snake_case dan bentuk ringkasan lama (`avg_oee`,
 * `total_parts`, `sample_count`) agar respons lama tetap termuat.
 *
 * E23 Batch 1 (FAT-180, N-11): spec live TIDAK membawa
 * `totalCount/goodCount/rejectCount` — item hanya membawa
 * `outputDelta/rejectDelta/goodDelta` (+ `sampleCount`). Bila count
 * eksplisit absen, turunkan dari delta (total = outputDelta, atau
 * good+reject bila outputDelta null); count eksplisit (demo/bentuk lama)
 * tetap menang. Tanpa ini `total_parts` selalu 0.
 */
export function mapAggregate(raw: unknown): TelemetryAggregatePoint {
  const r = (raw ?? {}) as Record<string, unknown>;
  const numOrNull = (v: unknown): number | null =>
    v === undefined || v === null ? null : Number.isFinite(num(v, NaN)) ? num(v, 0) : null;
  const outputDelta = numOrNull(pick(r.outputDelta, r.output_delta));
  const rejectDelta = numOrNull(pick(r.rejectDelta, r.reject_delta));
  const goodDelta = numOrNull(pick(r.goodDelta, r.good_delta));
  const totalRaw = pick(r.totalCount, r.total_count, r.total_parts, r.totalParts);
  const rejectRaw = pick(r.rejectCount, r.reject_count);
  const goodRaw = pick(r.goodCount, r.good_count);
  const rejectCount = rejectRaw !== undefined ? num(rejectRaw, 0) : (rejectDelta ?? 0);
  // API doc §Q: good = max(0, output − reject) bila tidak dikirim eksplisit.
  const totalCount =
    totalRaw !== undefined
      ? num(totalRaw, 0)
      : (outputDelta ?? (goodDelta ?? 0) + rejectCount);
  const item = {
    bucket: str(pick(r.bucket, r.bucket_start, r.bucketStart, r.hour), ''),
    totalCount,
    goodCount: goodRaw !== undefined ? num(goodRaw, 0) : (goodDelta ?? Math.max(0, totalCount - rejectCount)),
    rejectCount,
    operatingSec: num(pick(r.operatingSec, r.operating_sec), 0),
    runSec: num(pick(r.runSec, r.run_sec), 0),
    // E20 P20.5 (FAT-157): `*Pct` nullable dipertahankan (bukan 0) —
    // baca langsung dari field; alias legacy (`avg_*`) hanya fallback.
    availabilityPct: pctOrNull(r.availabilityPct, r.availability_pct, r.avg_availability, r.availability),
    performancePct: pctOrNull(r.performancePct, r.performance_pct, r.avg_performance, r.performance),
    qualityPct: pctOrNull(r.qualityPct, r.quality_pct, r.avg_quality, r.quality),
    oeePct: pctOrNull(r.oeePct, r.oee_pct, r.avg_oee, r.oee),
    sampleCount: num(pick(r.sampleCount, r.sample_count), 0),
    provisional: bool(pick(r.provisional), false),
    outputDelta,
    goodDelta,
    rejectDelta,
  };
  return mustParse(TelemetryAggregatePointSchema, item, 'agregat telemetri');
}

export function mapRollup(raw: unknown): TelemetryRollupItem {  const r = (raw ?? {}) as Record<string, unknown>;
  // E23 Batch 3 (FAT-195, N-26): spec live groupBy mencakup 'line'
  // (skema Zod diperluas); `lineId` item ikut dipetakan dan dipakai
  // sebagai groupKey baris lini.
  const lineId = (pick(r.lineId, r.line_id) as string | null) ?? null;
  const item = {
    groupBy: (pick(r.groupBy, r.group_by) as TelemetryRollupItem['groupBy']) ?? 'day',
    groupKey: str(pick(r.groupKey, r.lineId, r.line_id, r.machineId, r.machine_id, r.deviceId, r.device_id, r.bucket), 'row'),
    bucket: (pick(r.bucket) as string | null) ?? null,
    machineId: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_id: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_name: (pick(r.machineName, r.machine_name) as string | null) ?? null,
    device_id: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    lineId,
    totalCount: num(pick(r.totalCount, r.total_count), 0),
    goodCount: num(pick(r.goodCount, r.good_count), 0),
    rejectCount: num(pick(r.rejectCount, r.reject_count), 0),
    operatingSec: num(pick(r.operatingSec, r.operating_sec), 0),
    runSec: num(pick(r.runSec, r.run_sec), 0),
    availabilityPct: pctOrNull(r.availabilityPct, r.availability_pct),
    performancePct: pctOrNull(r.performancePct, r.performance_pct),
    qualityPct: pctOrNull(r.qualityPct, r.quality_pct),
    oeePct: pctOrNull(r.oeePct, r.oee_pct),
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
  // E23 Batch 3 (FAT-196, N-27): spec live TANPA totalCount/goodCount/
  // rejectCount dan TANPA nama shift/mesin. Parts diturunkan dari
  // hourly[] bila include_hourly diminta/dikembalikan — jumlahkan delta
  // per bucket seperti pola N-11 (total = Σ parts_produced, defect =
  // Σ defect_count, good = Σ good_count, fallback max(0, total−defect)
  // per bucket bila good_count tak ada); count eksplisit (demo/bentuk
  // lama) tetap menang. Tanpa hourly → null (tidak diketahui), JANGAN
  // fabrikasi 0. Nama shift/mesin → null bila tak dikirim (bukan
  // 'Shift'/'').
  const hourly = Array.isArray(r.hourly) ? (r.hourly as unknown[]).map((h) => mapHourly(h)) : undefined;
  const explicitTotal = pick(r.totalCount, r.total_count);
  const explicitGood = pick(r.goodCount, r.good_count);
  const explicitDefect = pick(r.rejectCount, r.reject_count);
  const derivedParts =
    hourly && hourly.length > 0
      ? hourly.reduce(
          (acc, p) => {
            const total = p.parts_produced;
            const defect = p.defect_count;
            const good = p.good_count ?? Math.max(0, total - defect);
            return { total: acc.total + total, good: acc.good + good, defect: acc.defect + defect };
          },
          { total: 0, good: 0, defect: 0 },
        )
      : null;
  return {
    shift_name: (pick(r.shift_name, r.shiftName, r.shift) as string | null) ?? null,
    machine_id: str(pick(r.machine_id, r.machineId, machineId), ''),
    machine_name: (pick(r.machine_name, r.machineName) as string | null) ?? null,
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
    total_parts: explicitTotal !== undefined ? num(explicitTotal, 0) : (derivedParts?.total ?? null),
    good_parts: explicitGood !== undefined ? num(explicitGood, 0) : (derivedParts?.good ?? null),
    defect_parts: explicitDefect !== undefined ? num(explicitDefect, 0) : (derivedParts?.defect ?? null),
    target_per_hour: (pick(r.target_per_hour, r.targetPerHour) as number | null) ?? null,
    // E20 P20.5 (FAT-157): baca `hourly[]` bila server menyertakannya
    // (`include_hourly=true`, §Q.1) — sebelumnya dibuang.
    hourly,
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
  // E23 Batch 2 (FAT-191, N-22): spec live
  // `{jobId, applicationName, scheduleInterval, maxRuntime,
  // lastRunStartedAt, lastSuccessfulFinish, lastRunStatus}` — mapper lama
  // membaca `name/view_name/last_run/lastStatus` yang TAK ADA di spec
  // (nama '', last_run epoch 1970, status selalu 'SUCCESS').
  // - `jobId` spec berupa number → string lokal.
  // - `view_name` tidak ada di spec; diisi applicationName agar deteksi
  //   hourly/daily di DataReconciliationPage tetap jalan.
  // - `last_run` = lastRunStartedAt (fallback lastSuccessfulFinish bila
  //   start tak ada); null → '' (bukan epoch — jangan pakai `iso()`).
  // - `lastRunStatus` nullable; nilai di luar union lokal → 'SUCCESS'.
  // - Spec tidak membawa `refresh_window_hours`/`records_processed` →
  //   tetap 0; `maxRuntime` tidak punya field lokal → tidak dipetakan.
  const jobIdRaw = pick(r.jobId, r.job_id);
  const appName = str(pick(r.applicationName, r.application_name, r.name), '');
  const lastRunStatus = pick(r.lastRunStatus, r.last_run_status, r.lastStatus, r.last_status);
  const startedAt = pick(r.lastRunStartedAt, r.last_run_started_at);
  const finishedAt = pick(r.lastSuccessfulFinish, r.last_successful_finish);
  const tsOrEmpty = (v: unknown): string => (typeof v === 'string' && v ? v : '');
  return {
    job_id: typeof jobIdRaw === 'number' ? String(jobIdRaw) : str(jobIdRaw, ''),
    name: appName,
    view_name: str(pick(r.view_name, r.viewName), appName),
    schedule_interval: str(pick(r.scheduleInterval, r.schedule_interval), ''),
    last_run: tsOrEmpty(startedAt) || tsOrEmpty(finishedAt),
    last_successful_finish: tsOrEmpty(finishedAt) || undefined,
    last_status: (
      lastRunStatus === 'SUCCESS' || lastRunStatus === 'RUNNING' || lastRunStatus === 'FAILED'
        ? lastRunStatus
        : 'SUCCESS'
    ) as ReconciliationJob['last_status'],
    refresh_window_hours: num(pick(r.refresh_window_hours, r.refreshWindowHours), 0),
    records_processed: num(pick(r.records_processed, r.recordsProcessed), 0),
  };
}
