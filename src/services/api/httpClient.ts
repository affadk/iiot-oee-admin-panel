/**
 * HTTP transport — mode Real (Build Guide §4.2, §4.3, §4.7).
 *
 * Dipakai hanya bila `VITE_API_MODE=real` (atau `?api=real` / pilihan di
 * Topbar). Seluruh halaman memanggil `apiClient` yang sama; transport ini
 * adalah implementasi alternatif dari store demo in-memory di `client.ts`.
 *
 * Kontrak yang dipenuhi (Guide §4.2):
 * - Base URL: `VITE_API_URL` atau `origin + /api/v1`; `/health` tanpa prefix.
 * - Header `Authorization: Bearer <token>` disisipkan per panggilan; token
 *   HANYA di memori (D5) — tidak pernah ke localStorage/cookie/log.
 * - Timeout: baca 10 s, mutasi 15 s, ekspor 120 s (env §4.1).
 * - Retry HANYA untuk GET yang gagal jaringan / 502/503/504, maks 3x,
 *   backoff eksponensial + jitter. TIDAK retry 400/401/403/404/409/422/429
 *   dan TIDAK pernah retry mutasi non-idempoten.
 * - Normalisasi list: array langsung ATAU `{data, meta}` (D7).
 * - Error envelope `{error, message, issues?, active_wo_id?}` dipetakan
 *   terpusat via `mapHttpErrorToApiError` (§4.3); 401 → logout, 403 →
 *   capability diturunkan (AuthContext).
 * - Ekspor mengembalikan file (bukan envelope): baca `Content-Disposition`
 *   + header `X-Export-*`.
 * - `204 No Content` (hapus dynsec) tidak diharapkan berisi JSON.
 * - TIDAK ADA evaluasi policy/role/scope di klien (§4.5/§4.6h): server yang
 *   memutuskan; klien hanya meneruskan 403 ke capability store.
 *
 * Pemetaan casing: backend memakai campuran camelCase (devices, machines,
 * products, operators, live-state, telemetry) dan snake_case (work-orders,
 * downtime, operational-events). Mapper di bawah menormalkan keduanya ke
 * bentuk snake_case lokal yang dipakai seluruh halaman, sehingga pergantian
 * mode Demo ↔ Real tidak mengubah UI apa pun.
 */
import { z } from 'zod';
import { ADMIN_ENDPOINTS, AdminEndpointKey } from './endpoints';
import {
  resolveOriginBaseUrl,
  resolveRequestTimeoutMs,
  resolveExportTimeoutMs,
  resolveWsUrl,
} from './mode';
import {
  AuthMeResponseSchema,
  LoginResponseSchema,
  RefreshResponseSchema,
  EdgeDeviceSchema,
  MachineSchema,
  OperatorSchema,
  ProductionLineSchema,
  ShiftSchema,
  ShiftScheduleSchema,
  TelemetryRollupItemSchema,
  mapHttpErrorToApiError,
  normalizeListResponse,
  isRetryableHttpStatus,
} from './schemas';
import {
  buildDowntimeExportEndpoint,
  buildDowntimeHistoryEndpoint,
  buildOperationalEventsEndpoint,
  buildOperationalEventsExportEndpoint,
  buildTelemetryExportEndpoint,
  buildTelemetryHistoryEndpoint,
  buildTelemetryHourlyExportEndpoint,
  buildTelemetryRollupEndpoint,
  buildWorkOrdersEndpoint,
  parseExportMetadataHeaders,
} from '../../utils/historicalExport';
import { normalizeFsmState } from '../../utils/oeeCalculations';
import { ApiError, LoginResponse, AuthMeResponse, NetworkAccessMode, UserRole } from '../../types/auth';
import { Machine, EdgeDevice, DeviceHealth, MachineStatusHistoryItem } from '../../types/assets';
import { WorkOrder, WorkOrderResolveResult, WorkOrderCancelResult, Product, Operator, ProductionLine, Shift, ShiftSchedule } from '../../types/production';
import { LiveStateRecord, DowntimeEvent, OperationalEvent, DowntimeCategory, MachineFsmState } from '../../types/monitoring';
import { ShiftSummary, HourlyOeePoint, ShiftTimelineSegment, RejectParetoItem, TelemetryHistoryRecord, TelemetryRollupItem, TelemetryRollupQuery, ReconciliationJob, ReconciliationRefreshRequest } from '../../types/analytics';
import { MqttClient, MqttRole, MqttAcl, MqttGroup, BrokerOverviewInfo, BrokerConfigSchema, BrokerConfigVersion, BrokerOperation, BrokerOperationStep, BrokerBackup } from '../../types/mqtt';
import { SystemHealth, AuditLogItem } from '../../types/system';
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../types/iam';
import { CursorPageResponse, DowntimeExportQuery, DowntimeHistoryQuery, ExportResult, OperationalEventsExportQuery, OperationalEventsQuery, TelemetryExportQuery, TelemetryHistoryQuery, WorkOrdersQuery } from '../../types/historical';
import { CapabilityKey } from '../../utils/capabilities';

interface AuthClientHooks {
  onUnauthorized?: (reason?: string) => void;
  onForbidden?: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ReqOpts {
  method?: HttpMethod;
  /** Path absolut: '/api/v1/...' atau '/health'. */
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  /** Timeout ms; default baca 10 s / mutasi 15 s (Guide §4.2). */
  timeoutMs?: number;
  /** Untuk atribusi 403 ke capability key (Guide §4.5). */
  capability?: CapabilityKey;
  resourceId?: string;
  /** Retry hanya untuk GET; default true bila method GET. */
  retry?: boolean;
  endpointKey?: AdminEndpointKey;
}

const READ_TIMEOUT_FALLBACK = 10_000;
const MUTATION_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const iso = (v: unknown): string => (typeof v === 'string' && v ? v : new Date(0).toISOString());
const pick = <T>(...vals: Array<T | undefined | null>): T | undefined => vals.find((v) => v !== undefined && v !== null);

/** Daftar mentah: array langsung atau `{data, meta}` (Guide D7). */
function splitList(raw: unknown): { items: unknown[]; meta: Record<string, unknown> | null } {
  if (Array.isArray(raw)) return { items: raw, meta: null };
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return { items: o.data, meta: (o.meta ?? o.pagination ?? null) as Record<string, unknown> | null };
  }
  return { items: [], meta: null };
}

function pageMeta(meta: Record<string, unknown> | null, fallbackLimit: number, count: number): CursorPageResponse<never>['pagination'] {
  const hasMore = Boolean(meta?.hasMore ?? meta?.has_more ?? false);
  return {
    limit: num(meta?.limit, fallbackLimit),
    next_cursor: (meta?.nextCursor ?? meta?.next_cursor ?? null) as string | null,
    has_more: hasMore,
    truncated: Boolean(meta?.truncated ?? hasMore),
    total_count: meta?.count !== undefined || meta?.total_count !== undefined ? num(meta?.count ?? meta?.total_count, count) : count,
  };
}

function invalidResponse(message: string): ApiError {
  return new ApiError({ code: 'INVALID_RESPONSE', message, httpStatus: 200 });
}

/** Validasi hasil mapping dengan skema Zod lokal; gagal parse = INVALID_RESPONSE (§4.2.7). */
function mustParse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidResponse(`Format ${label} dari server tidak sesuai skema.`);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Mapper backend -> tipe lokal (defensif terhadap camelCase & snake_case)
// ---------------------------------------------------------------------------

export function mapDevice(raw: unknown): EdgeDevice {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bound = (r.boundMachine ?? r.bound_machine ?? null) as Record<string, unknown> | null;
  return mustParse(EdgeDeviceSchema, {
    device_id: str(pick(r.deviceId, r.device_id)),
    model: str(pick(r.model), undefined) || undefined,
    serial_number: str(pick(r.serialNumber, r.serial_number), undefined) || undefined,
    mac_address: str(pick(r.macAddress, r.mac_address)),
    ip_address: (pick(r.ipAddress, r.ip_address) as string | null) ?? null,
    firmware_version: (pick(r.firmwareVersion, r.firmware_version) as string | null) ?? null,
    online: bool(pick(r.isOnline, r.online), false),
    last_seen: (pick(r.lastSeenAt, r.last_seen) as string | null) ?? null,
    bound_machine_id: (pick(bound?.machineId, bound?.machine_id) as string | null) ?? null,
    bound_machine_name: (pick(bound?.machineName, bound?.name) as string | null) ?? null,
    boundMachine: bound
      ? {
          device_id: str(pick(bound.deviceId, bound.device_id, r.deviceId, r.device_id)),
          mac_address: str(pick(bound.macAddress, bound.mac_address, r.macAddress, r.mac_address)),
          ip_address: (pick(bound.ipAddress, bound.ip_address) as string | null) ?? null,
          firmware_version: (pick(bound.firmwareVersion, bound.firmware_version) as string | null) ?? null,
          online: bool(pick(bound.isOnline, bound.online), false),
        }
      : null,
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'perangkat');
}

export function mapMachine(raw: unknown): Machine {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bound = (r.boundDevice ?? r.bound_device ?? null) as Record<string, unknown> | null;
  return mustParse(MachineSchema, {
    machine_id: str(pick(r.machineId, r.machine_id)),
    name: str(pick(r.machineName, r.name)),
    bound_device_id: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    boundDevice: bound
      ? {
          device_id: str(pick(bound.deviceId, bound.device_id)),
          mac_address: str(pick(bound.macAddress, bound.mac_address)),
          ip_address: (pick(bound.ipAddress, bound.ip_address) as string | null) ?? null,
          firmware_version: (pick(bound.firmwareVersion, bound.firmware_version) as string | null) ?? null,
          online: bool(pick(bound.isOnline, bound.online), false),
        }
      : null,
    modbus_slave_id: num(pick(r.modbusSlaveId, r.modbus_slave_id), 1),
    line_id: (pick(r.lineId, r.line_id) as string | null) ?? null,
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'mesin');
}

export function mapProduct(raw: unknown): Product {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    product_id: str(pick(r.productId, r.product_id)),
    sku: str(pick(r.sku, r.productId, r.product_id)),
    name: str(pick(r.productName, r.name)),
    ideal_cycle_time_seconds: num(pick(r.stdCycleTimeSec, r.std_cycle_time_sec, r.ideal_cycle_time_seconds), 0),
    active: bool(pick(r.isActive, r.active), true),
    created_at: iso(pick(r.createdAt, r.created_at)),
  };
}

export function mapOperator(raw: unknown): Operator {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(OperatorSchema, {
    operator_id: str(pick(r.operatorId, r.operator_id)),
    name: str(pick(r.operatorName, r.name)),
    role: str(pick(r.role), 'OPERATOR'),
    line_id: str(pick(r.lineId, r.line_id), 'LINE-01'),
    is_active: bool(pick(r.isActive, r.is_active), true),
    is_protected: bool(pick(r.isProtected, r.is_protected), false),
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'operator');
}

export function mapProductionLine(raw: unknown): ProductionLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(ProductionLineSchema, {
    lineId: str(pick(r.lineId, r.line_id)),
    lineName: str(pick(r.lineName, r.line_name)),
    description: (pick(r.description) as string | null) ?? null,
    isActive: bool(pick(r.isActive, r.is_active), true),
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'production line');
}

export function mapShift(raw: unknown): Shift {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(ShiftSchema, {
    shiftId: str(pick(r.shiftId, r.shift_id)),
    shiftName: str(pick(r.shiftName, r.shift_name)),
    shiftCode: str(pick(r.shiftCode, r.shift_code)),
    startTime: str(pick(r.startTime, r.start_time)),
    endTime: str(pick(r.endTime, r.end_time)),
    isActive: bool(pick(r.isActive, r.is_active), true),
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'shift');
}

export function mapShiftSchedule(raw: unknown): ShiftSchedule {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(ShiftScheduleSchema, {
    scheduleId: str(pick(r.scheduleId, r.schedule_id)),
    lineId: str(pick(r.lineId, r.line_id)),
    shiftId: str(pick(r.shiftId, r.shift_id)),
    dayOfWeek: num(pick(r.dayOfWeek, r.day_of_week), 1),
    isActive: bool(pick(r.isActive, r.is_active), true),
    shiftName: str(pick(r.shiftName, r.shift_name), undefined) || undefined,
    shiftCode: str(pick(r.shiftCode, r.shift_code), undefined) || undefined,
    startTime: str(pick(r.startTime, r.start_time), undefined) || undefined,
    endTime: str(pick(r.endTime, r.end_time), undefined) || undefined,
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'jadwal shift');
}

export function mapWorkOrder(raw: unknown): WorkOrder {
  const r = (raw ?? {}) as Record<string, unknown>;
  const woId = str(pick(r.wo_id, r.woId));
  return {
    wo_id: woId,
    order_number: str(pick(r.order_number, r.orderNumber, woId)),
    product_id: (pick(r.product_id, r.productId) as string | null) ?? null,
    product_name: (pick(r.product_name, r.productName) as string | null) ?? null,
    machine_id: (pick(r.machine_id, r.machineId) as string | null) ?? null,
    machine_name: (pick(r.machine_name, r.machineName) as string | null) ?? null,
    operator_id: (pick(r.operator_id, r.operatorId) as string | null) ?? null,
    operator_name: (pick(r.operator_name, r.operatorName) as string | null) ?? null,
    shift_name: str(pick(r.shift_name, r.shiftName, r.shift_code, r.shiftCode), ''),
    target_quantity: num(pick(r.target_qty, r.targetQty, r.target_quantity), 0),
    target_qty: num(pick(r.target_qty, r.targetQty), 0),
    completed_quantity: num(pick(r.completed_quantity, r.completedQuantity), 0),
    rejected_quantity: num(pick(r.rejected_quantity, r.rejectedQuantity), 0),
    status: (pick(r.status) as WorkOrder['status']) ?? 'PENDING',
    planned_start: iso(pick(r.planned_start, r.start_time, r.startTime, r.created_at, r.createdAt)),
    start_time: (pick(r.start_time, r.startTime) as string | null) ?? null,
    end_time: (pick(r.end_time, r.endTime) as string | null) ?? null,
    actual_start: (pick(r.actual_start, r.actualStart) as string | null) ?? null,
    actual_end: (pick(r.actual_end, r.actualEnd) as string | null) ?? null,
    notes: str(pick(r.notes), undefined) || undefined,
    cancel_reason: str(pick(r.cancel_reason, r.reason), undefined) || undefined,
  };
}

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

// ---------------------------------------------------------------------------
// Mapper lanjutan: telemetri, OEE, kualitas, MQTT, IAM, broker
// ---------------------------------------------------------------------------

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
    cycle_time_ms: num(pick(r.cycleTimeMs, r.lastCycleTimeSec, r.last_cycle_time_sec), 0) * 1000,
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
    targetPerHour: (pick(r.targetPerHour, r.target_per_hour) as number | null) ?? undefined,
    state: (pick(r.state) as MachineFsmState | null) ?? undefined,
    planned: bool(pick(r.planned), false),
    provisional: bool(pick(r.provisional), false),
  };
}

export function mapRollup(raw: unknown): TelemetryRollupItem {
  const r = (raw ?? {}) as Record<string, unknown>;
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
    planned_production_time_min: Math.round(operatingSec / 60),
    planned_break_min: num(pick(r.planned_break_min), 0) || undefined,
    operating_time_min: Math.round(operatingSec / 60),
    run_time_min: Math.round(runSec / 60),
    unplanned_downtime_min: Math.round(downtimeSec / 60),
    planned_downtime_min: 0,
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
    duration_min: Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000)),
  };
}

const EVENT_FLAG_BITS: Array<[number, string]> = [
  [1, 'NTP_SYNCED'],
  [2, 'MQTT_TLS_ACTIVE'],
  [4, 'MODBUS_HEALTHY'],
  [8, 'MODBUS_RETRY'],
];

/** Backend lama memakai bitmask angka; panel memakai string[] (drawer badge). */
function decodeEventFlags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'number') return EVENT_FLAG_BITS.filter(([bit]) => (v & bit) !== 0).map(([, name]) => name);
  return [];
}


export function mapMachineStatusHistory(raw: unknown): MachineStatusHistoryItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: (pick(r.id, r.historyId, r.history_id) as string | number | undefined) ??
      `${pick(r.machineId, r.machine_id)}-${pick(r.startedAt, r.started_at)}`,
    deviceId: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    machineId: str(pick(r.machineId, r.machine_id)),
    state: normalizeFsmState(str(pick(r.state, r.fsm_state), 'UNCONFIGURED')) as MachineStatusHistoryItem['state'],
    startedAt: iso(pick(r.startedAt, r.started_at)),
    endedAt: (pick(r.endedAt, r.ended_at) as string | null) ?? null,
    durationSec: num(pick(r.durationSec, r.duration_sec), 0),
    triggerSource: str(pick(r.triggerSource, r.trigger_source), 'SYSTEM'),
    isActive: bool(pick(r.isActive, r.is_active), false),
  };
}

export function mapDeviceHealth(raw: unknown): DeviceHealth {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    device_id: str(pick(r.deviceId, r.device_id)),
    timestamp: str(pick(r.timestamp), undefined) || undefined,
    heapFree: num(pick(r.heapFree, r.heap_free), 0),
    tasksHealthy: num(pick(r.tasksHealthy, r.tasks_healthy), 0),
    tasksTotal: num(pick(r.tasksTotal, r.tasks_total), 0),
    ageSec: num(pick(r.ageSec, r.age_sec), 999999),
    eventFlags: decodeEventFlags(pick(r.eventFlags, r.event_flags)),
    staleCount: num(pick(r.staleCount, r.stale_count), 0),
    staleTasks: (pick(r.staleTasks, r.stale_tasks) as string[]) ?? [],
  };
}

export function mapMqttClient(raw: unknown): MqttClient {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = (pick(r.roles) as unknown[]) ?? [];
  const groups = (pick(r.groups) as unknown[]) ?? [];
  return {
    username: str(pick(r.username)),
    clientid: str(pick(r.clientid, r.clientId), undefined) || undefined,
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    enabled: bool(pick(r.enabled, r.disabled) === undefined ? true : !bool(r.disabled, false), true),
    roles: roles.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).rolename))),
    groups: groups.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).groupname))),
    created_at: str(pick(r.created_at), undefined) || undefined,
    last_seen: str(pick(r.last_seen), undefined) || undefined,
  };
}

export function mapMqttRole(raw: unknown): MqttRole {
  const r = (raw ?? {}) as Record<string, unknown>;
  const acls = ((pick(r.acls) as unknown[]) ?? []).map((a) => {
    const ac = (a ?? {}) as Record<string, unknown>;
    return {
      acltype: str(pick(ac.acltype)) as MqttAcl['acltype'],
      topic: str(pick(ac.topic)),
      priority: num(pick(ac.priority), 0) || undefined,
      allow: bool(pick(ac.allow), true),
    } as MqttAcl;
  });
  return {
    rolename: str(pick(r.rolename)),
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    acls,
  };
}

export function mapMqttGroup(raw: unknown): MqttGroup {
  const r = (raw ?? {}) as Record<string, unknown>;
  const clients = (pick(r.clients) as unknown[]) ?? [];
  const roles = (pick(r.roles) as unknown[]) ?? [];
  return {
    groupname: str(pick(r.groupname)),
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    clients: clients.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).username))),
    roles: roles.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).rolename))),
  };
}

export function mapBrokerConfigVersion(raw: unknown): BrokerConfigVersion {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    version_id: str(pick(r.version_id, r.versionId, r.id)),
    parent_version_id: (pick(r.parent_version_id, r.parentVersionId) as string | null) ?? null,
    applied_at: iso(pick(r.applied_at, r.appliedAt, r.created_at, r.createdAt)),
    applied_by: str(pick(r.applied_by, r.appliedBy), 'system'),
    summary: str(pick(r.summary, r.reason, r.comment), ''),
    operation_type: (pick(r.operation_type, r.operationType) as BrokerConfigVersion['operation_type']) ?? 'NO_OPERATION',
    status: (pick(r.status) as BrokerConfigVersion['status']) ?? 'STAGED',
    config: (pick(r.config) as BrokerConfigSchema) ?? ({} as BrokerConfigSchema),
  };
}

export function mapBrokerOperation(raw: unknown): BrokerOperation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const steps = ((pick(r.steps) as unknown[]) ?? []).map((s) => {
    const st = (s ?? {}) as Record<string, unknown>;
    return {
      step: str(pick(st.step, st.name)),
      status: (pick(st.status) as BrokerOperationStep['status']) ?? 'PENDING',
      message: str(pick(st.message), undefined) || undefined,
    };
  });
  return {
    operation_id: str(pick(r.operation_id, r.operationId, r.id)),
    type: (pick(r.type, r.operation_type) as BrokerOperation['type']) ?? 'APPLY',
    version_id: str(pick(r.version_id, r.versionId)),
    status: (pick(r.status) as BrokerOperation['status']) ?? 'PENDING',
    reason: str(pick(r.reason), undefined) || undefined,
    steps,
    timestamp: iso(pick(r.timestamp, r.created_at, r.createdAt)),
    completed_at: (pick(r.completed_at, r.completedAt) as string | null) ?? null,
  };
}

export function mapIamRole(raw: unknown): IamRole {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.roleId, r.name)),
    name: str(pick(r.name)),
    // Hierarki level statis dihapus backend (Guide §4.6g / FR-032-20):
    // field dipertahankan untuk kompatibilitas tipe lokal, bukan otorisasi.
    privilege_level: num(pick(r.privilege_level, r.privilegeLevel), 1),
    is_system: bool(pick(r.is_system, r.isSystem, r.system), false),
    description: str(pick(r.description), ''),
    created_at: iso(pick(r.created_at, r.createdAt)),
    policy_count: num(pick(r.policy_count, r.policyCount), 0) || undefined,
  };
}

export function mapIamPermission(raw: unknown): IamPermission {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.permissionId)),
    action: str(pick(r.action)),
    resource_type: str(pick(r.resource_type, r.resourceType)),
    description: str(pick(r.description), ''),
  };
}

export function mapIamAssignment(raw: unknown): IamAssignment {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.assignmentId, `${pick(r.operator_id, r.operatorId)}:${pick(r.role_name, r.roleName)}`)),
    operator_id: str(pick(r.operator_id, r.operatorId)),
    operator_name: str(pick(r.operator_name, r.operatorName), ''),
    role_id: str(pick(r.role_id, r.roleId, r.role_name, r.roleName)),
    role_name: str(pick(r.role_name, r.roleName)),
    scope_type: (pick(r.scope_type, r.scopeType) as ScopeLevel) ?? 'ORGANIZATION',
    scope_id: (pick(r.scope_id, r.scopeId) as string | null) ?? null,
    created_at: iso(pick(r.created_at, r.createdAt)),
  };
}

export function mapIamPolicy(raw: unknown): IamPolicyRule {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.policyId)),
    role: str(pick(r.role, r.subject_match, r.subjectMatch, r.roleName)),
    subject_match: str(pick(r.subject_match, r.subjectMatch), undefined) || undefined,
    role_id: str(pick(r.role_id, r.roleId), undefined) || undefined,
    permission_id: str(pick(r.permission_id, r.permissionId), undefined) || undefined,
    action: str(pick(r.action)),
    resource_pattern: str(pick(r.resource_pattern, r.resourcePattern)),
    eft: (pick(r.eft, r.effect) as IamPolicyRule['eft']) ?? 'ALLOW',
    abac_condition: (pick(r.abac_condition, r.abacCondition) as IamPolicyRule['abac_condition']) ?? null,
    is_active: bool(pick(r.is_active, r.isActive, r.enabled), true),
    reason: str(pick(r.reason), undefined) || undefined,
  };
}

export function mapIamAuditDecision(raw: unknown): IamAuditDecision {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.auditId, `${pick(r.timestamp)}-${pick(r.subject)}`)),
    subject: str(pick(r.subject, r.subject_id)),
    decision: (pick(r.decision) as IamAuditDecision['decision']) ?? 'DENY',
    mode: (pick(r.mode) as IamAuditDecision['mode']) ?? 'shadow',
    action: str(pick(r.action)),
    resource: str(pick(r.resource)),
    reason: str(pick(r.reason), undefined) || undefined,
    timestamp: iso(pick(r.timestamp, r.created_at, r.createdAt)),
  };
}


export function mapBrokerOverview(raw: unknown): BrokerOverviewInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ds = (r.dynamicSecurity ?? r.dynamic_security ?? {}) as Record<string, unknown>;
  const cfg = (r.configuration ?? {}) as Record<string, unknown>;
  return {
    dynamicSecurity: {
      enabled: bool(pick(ds.enabled), false),
      status: (pick(ds.status, 'DISCONNECTED') as 'CONNECTED' | 'DISCONNECTED'),
      clientsCount: num(pick(ds.clientsCount, ds.clients_count), 0),
      rolesCount: num(pick(ds.rolesCount, ds.roles_count), 0),
      groupsCount: num(pick(ds.groupsCount, ds.groups_count), 0),
    },
    configuration: {
      status: (pick(cfg.status, 'IN_SYNC') as BrokerOverviewInfo['configuration']['status']),
      activeVersionId: (pick(cfg.activeVersionId, cfg.active_version) as string | null) ?? null,
      lastAppliedAt: (pick(cfg.lastAppliedAt, cfg.last_applied_at) as string | null) ?? null,
      mutationLocked: bool(pick(cfg.mutationLocked, cfg.mutation_locked), false),
    },
  };
}

export function mapMqttDynsecStatus(raw: unknown): {
  enabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED';
  clients_count: number;
  roles_count: number;
  groups_count: number;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(pick(r.enabled), false),
    status: (pick(r.status, 'DISCONNECTED') as 'CONNECTED' | 'DISCONNECTED'),
    clients_count: num(pick(r.clients_count, r.clientsCount), 0),
    roles_count: num(pick(r.roles_count, r.rolesCount), 0),
    groups_count: num(pick(r.groups_count, r.groupsCount), 0),
  };
}

export function mapBrokerConfigStatus(raw: unknown): {
  active_version: string;
  sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
  last_applied_at: string;
  mutation_locked: boolean;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    active_version: str(pick(r.active_version, r.activeVersionId, r.activeVersion), ''),
    sync_state: (pick(r.sync_state, r.syncState, r.status, 'IN_SYNC') as 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED'),
    last_applied_at: iso(pick(r.last_applied_at, r.lastAppliedAt)),
    mutation_locked: bool(pick(r.mutation_locked, r.mutationLocked), false),
  };
}

export function mapIamInfo(raw: unknown): IamInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    mode: (pick(r.mode, 'shadow') as IamInfo['mode']),
    authzVersion: num(pick(r.authzVersion, r.authz_version), 0),
    effectiveInMode: str(pick(r.effectiveInMode, r.effective_in_mode), ''),
    enforcedDomains: (r.enforcedDomains ?? r.enforced_domains) as string[] | undefined,
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

export function mapIamSubjectEffectivePermissions(raw: unknown, operatorId: string): IamEffectivePermissions {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = ((r.effectiveRoles ?? r.effective_roles ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      roleName: str(pick(e.roleName, e.role_name)),
      scopeType: (pick(e.scopeType, e.scope_type, 'ORGANIZATION') as ScopeLevel),
      scopeId: (pick(e.scopeId, e.scope_id) as string | null) ?? null,
    };
  });
  const perms = ((r.permissions ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      action: str(pick(e.action)),
      resourceType: str(pick(e.resourceType, e.resource_type)),
      resourcePattern: str(pick(e.resourcePattern, e.resource_pattern)),
      effect: (pick(e.effect, 'ALLOW') as 'ALLOW' | 'DENY'),
      sourceRole: str(pick(e.sourceRole, e.source_role)),
      abacCondition: (pick(e.abacCondition, e.abac_condition) as Record<string, unknown> | null) ?? null,
    };
  });
  return {
    operatorId: str(pick(r.operatorId, r.operator_id, operatorId)),
    primaryRole: str(pick(r.primaryRole, r.primary_role)),
    effectiveRoles: roles,
    permissions: perms,
  };
}

function paretoFromRows(raw: unknown): RejectParetoItem[] {
  const { items } = splitList(raw);
  const total = items.reduce<number>((sum, it) => sum + num((it as Record<string, unknown>).count, 0), 0);
  const runningTotal = { total, cumulative: 0 };
  return items.map((it) => {
    const rec = it as Record<string, unknown>;
    const enriched = {
      ...rec,
      pct: rec.pct ?? rec.percentage ?? (total > 0 ? (num(rec.count, 0) / total) * 100 : 0),
    };
    return mapReject(enriched, runningTotal);
  });
}

export function mapAuthMe(raw: unknown): AuthMeResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Backend punya dua bentuk (API doc §L vs Guide §4.9); terima keduanya.
  const authz = (r.authz ?? {}) as Record<string, unknown>;
  const operator = (r.operator ?? {}) as Record<string, unknown>;
  const flatCaps = (r.capabilities ?? authz.capabilities ?? {}) as unknown;
  const capabilities: Record<string, 'allow' | 'deny' | 'unknown'> = {};
  if (Array.isArray(flatCaps)) {
    for (const c of flatCaps as Array<Record<string, unknown>>) {
      const key = str(c.key);
      const decision = str(pick(c.decision, c.state), 'unknown');
      if (key) capabilities[key] = decision === 'allow' || decision === 'deny' ? decision : 'unknown';
    }
  } else if (flatCaps && typeof flatCaps === 'object') {
    for (const [k, v] of Object.entries(flatCaps as Record<string, unknown>)) {
      capabilities[k] = v === 'allow' || v === 'deny' ? v : 'unknown';
    }
  }
  const effectiveRolesRaw = (pick(authz.effectiveRoles, r.effectiveRoles) as unknown[]) ?? [];
  const effectiveRoles = effectiveRolesRaw.map((e) => {
    if (typeof e === 'string') return { roleName: e, scopeType: 'ORGANIZATION', scopeId: null };
    const o = (e ?? {}) as Record<string, unknown>;
    return {
      roleName: str(pick(o.roleName, o.role_name, o.role)),
      scopeType: str(pick(o.scopeType, o.scope_type), 'ORGANIZATION'),
      scopeId: (pick(o.scopeId, o.scope_id) as string | null) ?? null,
    };
  });
  const primaryRole = str(pick(r.primaryRole, authz.primaryRole, operator.role), 'OPERATOR') as UserRole;
  return {
    operator: {
      operator_id: str(pick(operator.id, operator.operator_id)),
      name: str(pick(operator.username, operator.name)),
      role: (pick(operator.role) as UserRole) ?? primaryRole,
      line_id: str(pick(operator.lineId, operator.line_id), undefined) || undefined,
    },
    primaryRole,
    effectiveRoles: effectiveRoles.length > 0 ? effectiveRoles : [{ roleName: primaryRole, scopeType: 'ORGANIZATION', scopeId: null }],
    authzVersion: num(pick(authz.authzVersion, r.authzVersion), 0),
    catalogueVersion: str(pick(authz.catalogueVersion, r.catalogueVersion), undefined) || undefined,
    mode: (pick(authz.mode, r.mode) as AuthMeResponse['mode']) ?? 'shadow',
    capabilities,
  };
}

// ---------------------------------------------------------------------------
// Transport core
// ---------------------------------------------------------------------------

let httpToken: string | null = null;
let networkMode: NetworkAccessMode = 'LAN';
let tokenAuthzVersion = 0;
let iamMode: 'shadow' | 'enforce' | 'partial' = 'shadow';
const calledKeys = new Set<AdminEndpointKey>();
const hooks: AuthClientHooks = {};

function fullUrl(path: string, query?: ReqOpts['query']): string {
  // Semua path sudah absolut dari origin (/api/v1/... atau /health).
  // resolveApiBaseUrl() SUDAH berakhiran /api/v1 — memakainya sebagai prefix
  // akan menggandakan prefix menjadi /api/v1/api/v1/... .
  const url = `${resolveOriginBaseUrl()}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertLanForMutation(): void {
  if (networkMode === 'REMOTE_TUNNEL') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Mode observasi (remote tunnel): perubahan dinonaktifkan. Aksi tulis hanya dari LAN pabrik.',
      httpStatus: 403,
    });
  }
}

function assertAuthenticatedHttp(): void {
  if (!httpToken) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Sesi berakhir. Silakan login ulang.', httpStatus: 401 });
  }
}

interface RawResult {
  status: number;
  text: string;
  json: unknown;
  headers: Headers;
}

async function fetchRaw(opts: ReqOpts): Promise<RawResult> {
  const method = opts.method ?? 'GET';
  const isRead = method === 'GET';
  const timeoutMs = opts.timeoutMs ?? (isRead ? resolveRequestTimeoutMs() || READ_TIMEOUT_FALLBACK : MUTATION_TIMEOUT_MS);
  const shouldRetry = opts.retry ?? isRead;
  const maxAttempts = shouldRetry ? MAX_ATTEMPTS : 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        throw new ApiError({ code: 'NETWORK', message: 'Permintaan dibatalkan.', httpStatus: 0 });
      }
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      if (httpToken) headers.Authorization = `Bearer ${httpToken}`;
      const res = await fetch(fullUrl(opts.path, opts.query), {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      if (!res.ok) {
        const status = res.status;
        if (isRetryableHttpStatus(status) && attempt + 1 < maxAttempts) {
          await sleep(200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100));
          continue;
        }
        throw mapHttpErrorToApiError(status, json ?? undefined);
      }
      return { status: res.status, text, json, headers: res.headers };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      const aborted = (err as Error)?.name === 'AbortError';
      const apiErr = new ApiError({
        code: 'NETWORK',
        message: aborted ? 'Waktu tunggu habis. Periksa koneksi ke backend.' : 'Koneksi jaringan terputus atau backend tidak terjangkau.',
        httpStatus: 0,
      });
      lastError = apiErr;
      if (shouldRetry && attempt + 1 < maxAttempts) {
        await sleep(200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100));
        continue;
      }
      throw apiErr;
    }
  }
  throw lastError as ApiError;
}

/** JSON request + pemetaan error terpusat + hook 401/403 (Guide §4.3/§4.5). */
async function reqJson<T>(opts: ReqOpts, parse?: (raw: unknown) => T): Promise<T> {
  try {
    const raw = await fetchRaw(opts);
    if (opts.endpointKey) calledKeys.add(opts.endpointKey);
    if (raw.status === 204 || !raw.text) return undefined as T;
    const data = raw.json;
    return parse ? parse(data) : (data as T);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.httpStatus === 401) hooks.onUnauthorized?.(err.message);
      if (err.httpStatus === 403) hooks.onForbidden?.(opts.capability ?? 'dashboard.read', opts.resourceId, err.message);
    }
    throw err;
  }
}

async function reqList<T>(
  opts: ReqOpts,
  mapItem: (raw: unknown) => T,
  fallbackLimit = 50,
): Promise<CursorPageResponse<T>> {
  const raw = await reqJson<unknown>(opts);
  const { items, meta } = splitList(raw);
  const data = items.map((it) => mapItem(it));
  return { data, pagination: pageMeta(meta, fallbackLimit, data.length) };
}

async function reqAllPages<T>(
  basePath: string,
  mapItem: (raw: unknown) => T,
  signal?: AbortSignal,
  endpointKey?: AdminEndpointKey,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res: CursorPageResponse<T> = await reqList(
      { path: basePath, query: { limit: 100, envelope: true, ...(cursor ? { cursor } : {}) }, signal, endpointKey },
      mapItem,
      100,
    );
    out.push(...res.data);
    cursor = res.pagination.next_cursor;
    if (!res.pagination.has_more || !cursor) break;
  }
  return out;
}

async function reqExport(opts: ReqOpts, format: 'csv' | 'ndjson' | 'json', fallbackName: string): Promise<ExportResult> {
  const raw = await fetchRaw({ ...opts, timeoutMs: resolveExportTimeoutMs(), retry: false });
  if (opts.endpointKey) calledKeys.add(opts.endpointKey);
  const headers: Record<string, string> = {};
  raw.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const metadata = parseExportMetadataHeaders({
    'X-Export-Source': headers['x-export-source'],
    'X-Export-Generated-At': headers['x-export-generated-at'],
    'X-Export-Device-Id': headers['x-export-device-id'],
    'X-Export-Time-Window': headers['x-export-time-window'],
  });
  const disposition = headers['content-disposition'] ?? '';
  const nameMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const filename = nameMatch ? decodeURIComponent(nameMatch[1].trim()) : fallbackName;
  const content = raw.text;
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const rowCount = format === 'csv' ? Math.max(0, lines.length - 1) : lines.length;
  return {
    filename,
    mimeType: headers['content-type'] ?? (format === 'csv' ? 'text/csv' : format === 'ndjson' ? 'application/x-ndjson' : 'application/json'),
    format,
    content,
    rowCount,
    metadata: { ...metadata, contentDisposition: disposition || undefined },
    endpoint: opts.path,
  };
}

function checkAbortHttp(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ApiError({ code: 'NETWORK', message: 'Permintaan dibatalkan.', httpStatus: 0 });
}

// ---------------------------------------------------------------------------
// httpApiClient — cermin 1:1 permukaan demo client (client.ts)
// ---------------------------------------------------------------------------

export const httpApiClient = {
  setAuthHooks(h: AuthClientHooks) {
    hooks.onUnauthorized = h.onUnauthorized;
    hooks.onForbidden = h.onForbidden;
  },

  getCalledEndpointKeys(): AdminEndpointKey[] {
    return Array.from(calledKeys);
  },

  resetEndpointTracker() {
    calledKeys.clear();
  },

  setNetworkMode(mode: NetworkAccessMode) {
    networkMode = mode;
  },

  getNetworkMode(): NetworkAccessMode {
    return networkMode;
  },

  setUserRole(_role: UserRole) {
    // Mode Real: peran berasal dari token server (GET /auth/me). Tidak ada
    // pengalih peran lokal — itu hanya alat demo. Diam-diam abaikan agar
    // Topbar tidak dapat melewati otorisasi server.
  },

  getUserRole(): UserRole {
    return 'ADMIN';
  },

  setTokenAuthzVersion(version: number) {
    tokenAuthzVersion = version;
  },

  setIamMode(mode: 'shadow' | 'enforce' | 'partial') {
    iamMode = mode;
  },

  setSessionActive(active: boolean, token?: string | null) {
    httpToken = active ? (token ?? httpToken) : null;
    if (!active) tokenAuthzVersion = 0;
  },

  // -- Auth (4 ops, Guide §4.4; login/refresh LAN-only) --------------------
  async login(operator_id: string, password?: string, station_id?: string): Promise<LoginResponse> {
    assertLanForMutation();
    const parsed = await reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath(),
        body: { operator_id: operator_id.trim(), password: password ?? '', ...(station_id ? { station_id } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'AUTH_LOGIN',
      },
      (raw) => LoginResponseSchema.parse(raw),
    );
    httpToken = parsed.token;
    return parsed;
  },

  async refreshSession(): Promise<{ token: string; expires_in: number; authz_version: number }> {
    assertLanForMutation();
    if (!httpToken) throw new ApiError({ code: 'UNAUTHORIZED', message: 'Tidak ada sesi untuk di-refresh.', httpStatus: 401 });
    const parsed = await reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.AUTH_REFRESH.buildPath(),
        body: { token: httpToken },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'AUTH_REFRESH',
      },
      (raw) => RefreshResponseSchema.parse(raw),
    );
    httpToken = parsed.token;
    return { token: parsed.token, expires_in: parsed.expires_in, authz_version: tokenAuthzVersion };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string }>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.AUTH_CHANGE_PASSWORD.buildPath(),
      // API doc §L: {current_password, new_password}. (Guide Lamp. J menulis
      // old_password — dicatat sebagai diskrepansi di AUDIT.md.)
      body: { current_password: currentPassword, new_password: newPassword },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'AUTH_CHANGE_PASSWORD',
    });
    return { success: raw?.success ?? true, message: raw?.message ?? 'Password berhasil diperbarui.' };
  },

  async getAuthMe(signal?: AbortSignal): Promise<AuthMeResponse> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.AUTH_ME.buildPath(), signal, endpointKey: 'AUTH_ME' },
      (raw) => {
        const mapped = mapAuthMe(raw);
        return mustParse(AuthMeResponseSchema, mapped, 'auth/me');
      },
    );
  },

  // -- Health & WS ----------------------------------------------------------
  async getSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
    checkAbortHttp(signal);
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.HEALTH.buildPath(),
      signal,
      endpointKey: 'HEALTH',
    });
    // Backend /health mengembalikan bentuk lean; panel butuh bentuk rich
    // (SystemHealthPage + contractAlignment test) — sintesis dari field lean.
    const uptime = num(pick(raw.uptime, raw.uptime_seconds), 0);
    const wsClients = num(pick(raw.ws_clients, raw.wsClients), 0);
    const dbConnected = bool(pick(raw.db_connected, raw.dbConnected), false);
    const backend = (raw.backend ?? {}) as Record<string, unknown>;
    const database = (raw.database ?? {}) as Record<string, unknown>;
    const mqtt = (raw.mqtt ?? {}) as Record<string, unknown>;
    const websocket = (raw.websocket ?? {}) as Record<string, unknown>;
    return {
      status: (pick(raw.status, 'ok') as SystemHealth['status']),
      uptime,
      uptime_seconds: num(pick(raw.uptime_seconds, raw.uptime), 0),
      timestamp: iso(raw.timestamp),
      ws_clients: wsClients,
      db_connected: dbConnected,
      buffer_pending: num(pick(raw.buffer_pending, raw.bufferPending), 0),
      buffer_dropped: num(pick(raw.buffer_dropped, raw.bufferDropped), 0),
      backend: {
        status: (pick(backend.status, dbConnected ? 'UP' : 'DOWN') as 'UP' | 'DOWN'),
        label: str(pick(backend.label), 'API v1'),
        environment: str(pick(backend.environment), 'production'),
        latency_ms: num(pick(backend.latency_ms, backend.latencyMs), 0),
      },
      database: {
        engine: str(pick(database.engine), 'PostgreSQL'),
        latency_ms: num(pick(database.latency_ms, database.latencyMs), 0),
      },
      mqtt: {
        status: (pick(mqtt.status, 'UP') as 'UP' | 'DOWN'),
        connected_clients: num(pick(mqtt.connected_clients, mqtt.connectedClients, wsClients), 0),
        dynamic_security: str(pick(mqtt.dynamic_security, mqtt.dynamicSecurity), 'enabled'),
      },
      websocket: {
        status: (pick(websocket.status, 'UP') as 'UP' | 'DOWN'),
      },
      metrics: raw.metrics
        ? {
            totalReceived: num((raw.metrics as Record<string, unknown>).totalReceived, 0),
            validIngested: num((raw.metrics as Record<string, unknown>).validIngested, 0),
            invalidDiscarded: num((raw.metrics as Record<string, unknown>).invalidDiscarded, 0),
            lastIngestedAt: ((raw.metrics as Record<string, unknown>).lastIngestedAt as string | null) ?? null,
          }
        : null,
    };
  },

  getTelemetryWebSocketUrl(): string {
    return resolveWsUrl();
  },

  // -- Devices (6 ops; command HMI-only — tidak ada di sini) ---------------
  async getDevices(signal?: AbortSignal): Promise<EdgeDevice[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.DEVICES_LIST.buildPath(), mapDevice, signal, 'DEVICES_LIST');
  },

  async getDeviceById(deviceId: string, signal?: AbortSignal): Promise<EdgeDevice> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.DEVICES_GET.buildPath(deviceId), signal, endpointKey: 'DEVICES_GET', capability: 'device.read', resourceId: deviceId },
      mapDevice,
    );
  },

  async getDeviceHealth(deviceId: string, signal?: AbortSignal): Promise<DeviceHealth> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.DEVICES_HEALTH.buildPath(deviceId), signal, endpointKey: 'DEVICES_HEALTH', capability: 'device.read', resourceId: deviceId },
      mapDeviceHealth,
    );
  },

  async registerDevice(data: {
    device_id: string;
    model?: string;
    serial_number?: string;
    mac_address: string;
    ip_address?: string | null;
    firmware_version?: string | null;
  }): Promise<EdgeDevice> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.DEVICES_CREATE.buildPath(),
        body: {
          deviceId: data.device_id.trim(),
          macAddress: data.mac_address.trim(),
          ...(data.ip_address ? { ipAddress: data.ip_address.trim() } : {}),
          ...(data.firmware_version ? { firmwareVersion: data.firmware_version.trim() } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_CREATE',
        capability: 'device.manage',
        resourceId: data.device_id,
      },
      mapDevice,
    );
  },

  async updateDevice(
    deviceId: string,
    patch: { ip_address?: string | null; firmware_version?: string | null },
  ): Promise<EdgeDevice> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.DEVICES_UPDATE.buildPath(deviceId),
        body: {
          ...(patch.ip_address !== undefined ? { ipAddress: patch.ip_address } : {}),
          ...(patch.firmware_version !== undefined ? { firmwareVersion: patch.firmware_version } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_UPDATE',
        capability: 'device.manage',
        resourceId: deviceId,
      },
      mapDevice,
    );
  },

  async deleteDevice(deviceId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.DEVICES_DELETE.buildPath(deviceId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'DEVICES_DELETE',
      capability: 'device.manage',
      resourceId: deviceId,
    });
    return { success: raw?.success ?? true };
  },

  // -- Machines (8 ops) ------------------------------------------------------
  async getMachinesPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Machine>> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.MACHINES_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'MACHINES_LIST',
      },
      mapMachine,
      query.limit ?? 50,
    );
  },

  async getMachines(signal?: AbortSignal): Promise<Machine[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.MACHINES_LIST.buildPath(), mapMachine, signal, 'MACHINES_LIST');
  },

  async getMachineById(machineId: string, signal?: AbortSignal): Promise<Machine> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.MACHINES_GET.buildPath(machineId), signal, endpointKey: 'MACHINES_GET', capability: 'machine.read', resourceId: machineId },
      mapMachine,
    );
  },


  async getMachineStatusHistory(
    machineId: string,
    query: { from?: string; to?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<MachineStatusHistoryItem>> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.MACHINES_STATUS_HISTORY.buildPath(machineId),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'MACHINES_STATUS_HISTORY',
        capability: 'machine.read',
        resourceId: machineId,
      },
      mapMachineStatusHistory,
      query.limit ?? 50,
    );
  },

  async createMachine(data: {
    machine_id: string;
    name: string;
    modbus_slave_id?: number;
    bound_device_id?: string | null;
  }): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_CREATE.buildPath(),
        body: {
          machineId: data.machine_id.trim(),
          machineName: data.name.trim(),
          ...(data.bound_device_id ? { deviceId: data.bound_device_id } : {}),
          ...(data.modbus_slave_id !== undefined ? { modbusSlaveId: data.modbus_slave_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_CREATE',
        capability: 'machine.manage',
        resourceId: data.machine_id,
      },
      mapMachine,
    );
  },

  async updateMachine(
    machineId: string,
    patch: { name?: string; modbus_slave_id?: number },
  ): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.MACHINES_UPDATE.buildPath(machineId),
        body: {
          ...(patch.name !== undefined ? { machineName: patch.name } : {}),
          ...(patch.modbus_slave_id !== undefined ? { modbusSlaveId: patch.modbus_slave_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_UPDATE',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  },

  async deleteMachine(machineId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MACHINES_DELETE.buildPath(machineId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MACHINES_DELETE',
      capability: 'machine.manage',
      resourceId: machineId,
    });
    return { success: raw?.success ?? true };
  },

  async bindDevice(machineId: string, deviceIdInput: string | { device_id: string }): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const deviceId = typeof deviceIdInput === 'string' ? deviceIdInput : deviceIdInput.device_id;
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_BIND.buildPath(machineId),
        body: { device_id: deviceId.trim() },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_BIND',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  },

  async unbindDevice(machineId: string): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_UNBIND.buildPath(machineId),
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_UNBIND',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  },

  // -- Products (5 ops) ------------------------------------------------------
  async getProductsPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Product>> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'PRODUCTS_LIST',
      },
      mapProduct,
      query.limit ?? 50,
    );
  },

  async getProducts(signal?: AbortSignal): Promise<Product[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath(), mapProduct, signal, 'PRODUCTS_LIST');
  },

  async getProductById(productId: string, signal?: AbortSignal): Promise<Product> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.PRODUCTS_GET.buildPath(productId), signal, endpointKey: 'PRODUCTS_GET', capability: 'product.read', resourceId: productId },
      mapProduct,
    );
  },

  async createProduct(data: {
    product_id: string;
    sku?: string;
    name: string;
    ideal_cycle_time_seconds: number;
    active?: boolean;
  }): Promise<Product> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.PRODUCTS_CREATE.buildPath(),
        body: { productId: data.product_id.trim(), productName: data.name.trim(), stdCycleTimeSec: data.ideal_cycle_time_seconds },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTS_CREATE',
        capability: 'product.manage',
        resourceId: data.product_id,
      },
      mapProduct,
    );
  },

  async updateProduct(
    productId: string,
    patch: { sku?: string; name?: string; ideal_cycle_time_seconds?: number; active?: boolean },
  ): Promise<Product> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId),
        body: {
          ...(patch.name !== undefined ? { productName: patch.name } : {}),
          ...(patch.ideal_cycle_time_seconds !== undefined ? { stdCycleTimeSec: patch.ideal_cycle_time_seconds } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTS_UPDATE',
        capability: 'product.manage',
        resourceId: productId,
      },
      mapProduct,
    );
  },

  async deleteProduct(productId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.PRODUCTS_DELETE.buildPath(productId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'PRODUCTS_DELETE',
      capability: 'product.manage',
      resourceId: productId,
    });
    return { success: raw?.success ?? true };
  },

  // -- Operators (7 ops; roster terproteksi ADMIN/SUPERVISOR LAN) -----------
  async getOperators(signal?: AbortSignal): Promise<Operator[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.OPERATORS_LIST.buildPath(), signal, endpointKey: 'OPERATORS_LIST', capability: 'operator.read' },
      mapOperator,
      50,
    ).then((p) => p.data);
  },

  async getOperatorById(operatorId: string, signal?: AbortSignal): Promise<Operator> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.OPERATORS_GET.buildPath(operatorId), signal, endpointKey: 'OPERATORS_GET', capability: 'operator.read', resourceId: operatorId },
      mapOperator,
    );
  },

  async createOperator(data: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
    password: string;
    is_active?: boolean;
  }): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.OPERATORS_CREATE.buildPath(),
        body: {
          operatorId: data.operator_id.trim(),
          operatorName: data.name.trim(),
          role: data.role,
          password: data.password,
          ...(data.line_id ? { lineId: data.line_id.trim() } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_CREATE',
        capability: 'operator.create',
        resourceId: data.operator_id,
      },
      mapOperator,
    );
  },

  async updateOperator(
    operatorId: string,
    patch: { name?: string; role?: UserRole; line_id?: string },
  ): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.OPERATORS_UPDATE.buildPath(operatorId),
        body: {
          ...(patch.name !== undefined ? { operatorName: patch.name } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.line_id !== undefined ? { lineId: patch.line_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_UPDATE',
        capability: 'operator.update',
        resourceId: operatorId,
      },
      mapOperator,
    );
  },

  async deleteOperator(operatorId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.OPERATORS_DELETE.buildPath(operatorId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATORS_DELETE',
      capability: 'operator.delete',
      resourceId: operatorId,
    });
    return { success: raw?.success ?? true };
  },

  async rotateOperatorPassword(operatorId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string } | undefined>({
      method: 'PATCH',
      path: ADMIN_ENDPOINTS.OPERATORS_PASSWORD.buildPath(operatorId),
      body: { newPassword },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATORS_PASSWORD',
      capability: 'operator.password.rotate',
      resourceId: operatorId,
    });
    return { success: raw?.success ?? true, message: raw?.message ?? `Password untuk ${operatorId} berhasil dirotasi.` };
  },

  async toggleOperatorStatus(operatorId: string, isActive: boolean): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.OPERATORS_STATUS.buildPath(operatorId),
        body: { isActive },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_STATUS',
        capability: 'operator.status.update',
        resourceId: operatorId,
      },
      mapOperator,
    );
  },

  // -- Production Lines / Shifts / Shift Schedules (5 ops masing-masing) -----
  async getProductionLinesPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<ProductionLine>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'PRODUCTION_LINES_LIST',
        capability: 'production_line.read',
      },
      mapProductionLine,
      query.limit ?? 50,
    );
  },

  async getProductionLineById(lineId: string, signal?: AbortSignal): Promise<ProductionLine> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.PRODUCTION_LINES_GET.buildPath(lineId), signal, endpointKey: 'PRODUCTION_LINES_GET', capability: 'production_line.read', resourceId: lineId },
      mapProductionLine,
    );
  },

  async createProductionLine(data: { lineId: string; lineName: string; description?: string | null; isActive?: boolean }): Promise<ProductionLine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_CREATE.buildPath(),
        body: { lineId: data.lineId.trim(), lineName: data.lineName.trim(), description: data.description ?? null, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTION_LINES_CREATE',
        capability: 'production_line.manage',
        resourceId: data.lineId,
      },
      mapProductionLine,
    );
  },

  async updateProductionLine(
    lineId: string,
    patch: { lineName?: string; description?: string | null; isActive?: boolean },
  ): Promise<ProductionLine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_UPDATE.buildPath(lineId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTION_LINES_UPDATE',
        capability: 'production_line.manage',
        resourceId: lineId,
      },
      mapProductionLine,
    );
  },

  async deleteProductionLine(lineId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.PRODUCTION_LINES_DELETE.buildPath(lineId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'PRODUCTION_LINES_DELETE',
      capability: 'production_line.manage',
      resourceId: lineId,
    });
    return { success: raw?.success ?? true };
  },

  async getShiftsPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Shift>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SHIFTS_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'SHIFTS_LIST',
        capability: 'shift.read',
      },
      mapShift,
      query.limit ?? 50,
    );
  },

  async getShiftById(shiftId: string, signal?: AbortSignal): Promise<Shift> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.SHIFTS_GET.buildPath(shiftId), signal, endpointKey: 'SHIFTS_GET', capability: 'shift.read', resourceId: shiftId },
      mapShift,
    );
  },

  async createShift(data: { shiftId: string; shiftName: string; shiftCode: string; startTime: string; endTime: string; isActive?: boolean }): Promise<Shift> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.SHIFTS_CREATE.buildPath(),
        body: { shiftId: data.shiftId.trim(), shiftName: data.shiftName.trim(), shiftCode: data.shiftCode.trim(), startTime: data.startTime, endTime: data.endTime, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFTS_CREATE',
        capability: 'shift.manage',
        resourceId: data.shiftId,
      },
      mapShift,
    );
  },

  async updateShift(
    shiftId: string,
    patch: { shiftName?: string; shiftCode?: string; startTime?: string; endTime?: string; isActive?: boolean },
  ): Promise<Shift> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.SHIFTS_UPDATE.buildPath(shiftId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFTS_UPDATE',
        capability: 'shift.manage',
        resourceId: shiftId,
      },
      mapShift,
    );
  },

  async deleteShift(shiftId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.SHIFTS_DELETE.buildPath(shiftId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'SHIFTS_DELETE',
      capability: 'shift.manage',
      resourceId: shiftId,
    });
    return { success: raw?.success ?? true };
  },

  async getShiftSchedulesPage(
    query: { line_id?: string; shift_id?: string; day_of_week?: number; is_active?: boolean; cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<ShiftSchedule>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_LIST.buildPath(),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.line_id ? { line_id: query.line_id } : {}),
          ...(query.shift_id ? { shift_id: query.shift_id } : {}),
          ...(query.day_of_week !== undefined ? { day_of_week: query.day_of_week } : {}),
          ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'SHIFT_SCHEDULES_LIST',
        capability: 'shift_schedule.read',
      },
      mapShiftSchedule,
      query.limit ?? 50,
    );
  },

  async getShiftScheduleById(scheduleId: string, signal?: AbortSignal): Promise<ShiftSchedule> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_GET.buildPath(scheduleId), signal, endpointKey: 'SHIFT_SCHEDULES_GET', capability: 'shift_schedule.read', resourceId: scheduleId },
      mapShiftSchedule,
    );
  },

  async createShiftSchedule(data: { lineId: string; shiftId: string; dayOfWeek: number; isActive?: boolean }): Promise<ShiftSchedule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_CREATE.buildPath(),
        body: { lineId: data.lineId, shiftId: data.shiftId, dayOfWeek: data.dayOfWeek, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFT_SCHEDULES_CREATE',
        capability: 'shift_schedule.manage',
      },
      mapShiftSchedule,
    );
  },

  async updateShiftSchedule(
    scheduleId: string,
    patch: { lineId?: string; shiftId?: string; dayOfWeek?: number; isActive?: boolean },
  ): Promise<ShiftSchedule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_UPDATE.buildPath(scheduleId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFT_SCHEDULES_UPDATE',
        capability: 'shift_schedule.manage',
        resourceId: scheduleId,
      },
      mapShiftSchedule,
    );
  },

  async deleteShiftSchedule(scheduleId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_DELETE.buildPath(scheduleId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'SHIFT_SCHEDULES_DELETE',
      capability: 'shift_schedule.manage',
      resourceId: scheduleId,
    });
    return { success: raw?.success ?? true };
  },

  // -- Work Orders (4 ops admin: list/detail/resolve/cancel; dispatch,
  //    validate-zone, initiate-from-zones, complete = HMI-only, TIDAK ADA) ---
  async getWorkOrdersPage(
    query: WorkOrdersQuery = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<WorkOrder>> {
    checkAbortHttp(signal);
    const endpoint = buildWorkOrdersEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'WORK_ORDERS_LIST' }, mapWorkOrder, query.limit ?? 50);
  },

  async getWorkOrders(signal?: AbortSignal): Promise<WorkOrder[]> {
    const page = await this.getWorkOrdersPage({ limit: 100 }, signal);
    return page.data;
  },

  async getWorkOrderById(woId: string, signal?: AbortSignal): Promise<WorkOrder> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.WORK_ORDERS_GET.buildPath(woId), signal, endpointKey: 'WORK_ORDERS_GET', capability: 'work_order.read', resourceId: woId },
      mapWorkOrder,
    );
  },

  async resolveWorkOrder(woId: string, deviceId?: string, signal?: AbortSignal): Promise<WorkOrderResolveResult> {
    checkAbortHttp(signal);
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.WORK_ORDERS_RESOLVE.buildPath(woId),
      query: deviceId ? { device_id: deviceId } : undefined,
      signal,
      endpointKey: 'WORK_ORDERS_RESOLVE',
      capability: 'work_order.read',
      resourceId: woId,
    });
    const wo = (raw.work_order ?? {}) as Record<string, unknown>;
    const shiftPlan = (wo.shift_plan ?? {}) as Record<string, unknown>;
    const brk = (wo.break ?? {}) as Record<string, unknown>;
    return {
      success: bool(raw.success, true),
      work_order: {
        wo_id: str(pick(wo.wo_id, wo.woId, woId)),
        machine_id: (pick(wo.machine_id, wo.machineId) as string | null) ?? null,
        product_id: (pick(wo.product_id, wo.productId) as string | null) ?? null,
        product_name: (pick(wo.product_name, wo.productName) as string | null) ?? null,
        std_cycle_time_sec: num(pick(wo.std_cycle_time_sec, wo.stdCycleTimeSec), 0),
        operator_id: (pick(wo.operator_id, wo.operatorId) as string | null) ?? null,
        operator_name: (pick(wo.operator_name, wo.operatorName) as string | null) ?? null,
        target_qty: num(pick(wo.target_qty, wo.targetQty), 0),
        targetPerHour: num(pick(wo.targetPerHour, wo.target_per_hour), 0),
        shift_plan: {
          shift_start: str(pick(shiftPlan.shift_start, shiftPlan.shiftStart), ''),
          shift_end: str(pick(shiftPlan.shift_end, shiftPlan.shiftEnd), ''),
          planned_break_min: num(pick(shiftPlan.planned_break_min, shiftPlan.plannedBreakMin), 0),
          planned_operating_sec: num(pick(shiftPlan.planned_operating_sec, shiftPlan.plannedOperatingSec), 0),
        },
        break: {
          start: str(pick(brk.start), ''),
          end: str(pick(brk.end), ''),
          minutes: num(pick(brk.minutes), 0),
        },
        status: (pick(wo.status) as WorkOrderResolveResult['work_order']['status']) ?? 'PENDING',
      },
    };
  },

  async cancelWorkOrder(woId: string, reason?: string): Promise<WorkOrderCancelResult> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.WORK_ORDERS_CANCEL.buildPath(woId),
      body: reason ? { reason } : {},
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'WORK_ORDERS_CANCEL',
      capability: 'work_order.cancel',
      resourceId: woId,
    });
    const wo = (raw.work_order ?? {}) as Record<string, unknown>;
    return {
      success: bool(raw.success, true),
      work_order: {
        wo_id: str(pick(wo.wo_id, wo.woId, woId)),
        status: 'ABORTED',
        machine_id: (pick(wo.machine_id, wo.machineId) as string | null) ?? null,
      },
    };
  },

  // -- Live State ------------------------------------------------------------
  async getLiveState(signal?: AbortSignal): Promise<LiveStateRecord[]> {
    checkAbortHttp(signal);
    return reqList(
      { path: ADMIN_ENDPOINTS.LIVE_STATE.buildPath(), signal, endpointKey: 'LIVE_STATE' },
      mapLiveState,
      100,
    ).then((p) => p.data);
  },

  async getLiveStateByDevice(deviceId: string, signal?: AbortSignal): Promise<LiveStateRecord> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.LIVE_STATE_BY_DEVICE.buildPath(deviceId), signal, endpointKey: 'LIVE_STATE_BY_DEVICE', capability: 'telemetry.read', resourceId: deviceId },
      mapLiveState,
    );
  },

  // -- Downtime ---------------------------------------------------------------
  async getActiveDowntimes(signal?: AbortSignal): Promise<DowntimeEvent[]> {
    checkAbortHttp(signal);
    return reqList(
      { path: ADMIN_ENDPOINTS.DOWNTIME_ACTIVE.buildPath(), signal, endpointKey: 'DOWNTIME_ACTIVE' },
      mapDowntime,
      100,
    ).then((p) => p.data);
  },

  async getDowntimeHistory(deviceId: string, signal?: AbortSignal): Promise<DowntimeEvent[]> {
    const page = await this.getDowntimeHistoryPage({ device_id: deviceId, limit: 100 }, signal);
    return page.data;
  },

  async getDowntimeHistoryPage(
    query: DowntimeHistoryQuery,
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<DowntimeEvent>> {
    checkAbortHttp(signal);
    const endpoint = buildDowntimeHistoryEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'DOWNTIME_BY_DEVICE' }, mapDowntime, query.limit ?? 50);
  },

  async exportDowntimeData(query: DowntimeExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildDowntimeExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'DOWNTIME_DEVICE_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `downtime_${query.device_id}.csv`,
    );
  },

  async classifyDowntimeReason(
    id: string,
    category: DowntimeCategory,
    reason: string,
    notes?: string,
  ): Promise<DowntimeEvent> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.DOWNTIME_REASON.buildPath(id),
      body: { category, reason, ...(notes ? { notes } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'DOWNTIME_REASON',
      capability: 'downtime.reason.label',
      resourceId: id,
    });
    return mapDowntime({ ...raw, id: pick(raw.eventId, raw.event_id, id), category, operatorReason: reason });
  },

  // -- Operational Events & System Audit --------------------------------------
  async getOperationalEventsByDevice(
    deviceId: string,
    query: Omit<OperationalEventsQuery, 'device_id'> = {},
    signal?: AbortSignal,
  ): Promise<OperationalEvent[]> {
    const page = await this.getOperationalEventsPage({ ...query, device_id: deviceId }, signal);
    return page.data;
  },

  async getOperationalEvents(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal,
  ): Promise<OperationalEvent[]> {
    const page = await this.getOperationalEventsPage(query, signal);
    return page.data;
  },

  async getOperationalEventsPage(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<OperationalEvent>> {
    checkAbortHttp(signal);
    const endpoint = buildOperationalEventsEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'OPERATIONAL_EVENTS_LIST' }, mapOperationalEvent, query.limit ?? 50);
  },

  async exportOperationalEventsData(
    query: OperationalEventsExportQuery,
    signal?: AbortSignal,
  ): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildOperationalEventsExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'OPERATIONAL_EVENTS_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      'operational-events.csv',
    );
  },

  async acknowledgeOperationalEvent(id: string, note?: string): Promise<OperationalEvent> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'PATCH',
      path: ADMIN_ENDPOINTS.OPERATIONAL_EVENTS_ACK.buildPath(id),
      body: { ...(note ? { note } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATIONAL_EVENTS_ACK',
      capability: 'operational_event.ack',
      resourceId: id,
    });
    return mapOperationalEvent({
      ...raw,
      id: pick(raw.id, id),
      acknowledged: true,
      acknowledgedAt: pick(raw.acknowledgedAt, raw.acknowledged_at),
      acknowledgedBy: pick(raw.acknowledgedBy, raw.acknowledged_by),
      ackNote: pick(raw.ackNote, raw.ack_note, note),
    });
  },

  async getSystemAuditPage(
    query: { from?: string; to?: string; event_type?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<AuditLogItem>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SYSTEM_AUDIT.buildPath(),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(query.event_type ? { event_type: query.event_type } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'SYSTEM_AUDIT',
        capability: 'audit.system.read',
      },
      mapAuditLog,
      query.limit ?? 50,
    );
  },

  async getAuditLogs(signal?: AbortSignal): Promise<AuditLogItem[]> {
    const page = await this.getSystemAuditPage({ limit: 200 }, signal);
    return page.data;
  },

  // -- Telemetry ----------------------------------------------------------------
  async getTelemetryHistory(deviceId: string, signal?: AbortSignal): Promise<TelemetryHistoryRecord[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.TELEMETRY_HISTORY.buildPath(deviceId), signal, endpointKey: 'TELEMETRY_HISTORY', capability: 'telemetry.read', resourceId: deviceId },
      mapTelemetryHistory,
      100,
    ).then((p) => p.data);
  },
  async getHourlyTrend(deviceId: string, signal?: AbortSignal): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId), signal, endpointKey: 'TELEMETRY_HOURLY', capability: 'telemetry.read', resourceId: deviceId },
      mapHourly,
      100,
    ).then((p) => p.data);
  },
  async getTelemetryAggregate(
    deviceId: string,
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    signal?: AbortSignal
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
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const rows = await reqList(
      {
        path: ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId),
        query: { bucket },
        signal,
        endpointKey: 'TELEMETRY_AGGREGATE',
        capability: 'telemetry.read',
        resourceId: deviceId,
      },
      (raw) => raw as Record<string, unknown>,
      100,
    ).then((p) => p.data);
    const first = rows[0] ?? {};
    return {
      device_id: deviceId,
      bucket,
      avg_oee: num(pick(first.avg_oee, first.avgOee, first.oeePct, first.oee), 0),
      avg_availability: num(pick(first.avg_availability, first.avgAvailability, first.availabilityPct, first.availability), 0),
      avg_performance: num(pick(first.avg_performance, first.avgPerformance, first.performancePct, first.performance), 0),
      avg_quality: num(pick(first.avg_quality, first.avgQuality, first.qualityPct, first.quality), 0),
      total_parts: num(pick(first.total_parts, first.totalParts, first.total_count, first.totalCount), 0),
      sample_count: num(pick(first.sample_count, first.sampleCount), 0),
    };
  },
  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryRollupEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'TELEMETRY_ROLLUP' }, mapRollup, query.limit ?? 50);
  },
  async exportTelemetryData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `telemetry_${query.device_id}.csv`,
    );
  },
  async exportTelemetryHourlyData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryHourlyExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_HOURLY_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `telemetry_hourly_${query.device_id}.csv`,
    );
  },
  async getTelemetryHistoryPage(
    query: TelemetryHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryHistoryRecord>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryHistoryEndpoint(query);
    return reqList(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_HISTORY', capability: 'telemetry.read', resourceId: query.device_id },
      mapTelemetryHistory,
      query.limit ?? 50,
    );
  },
  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.OEE_HOURLY.buildPath(),
        query: {
          ...(params.machine_id ? { machine_id: params.machine_id } : {}),
          ...(params.device_id ? { device_id: params.device_id } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
        signal,
        endpointKey: 'OEE_HOURLY',
      },
      mapHourly,
      params.limit ?? 100,
    ).then((p) => p.data);
  },
  async getShiftSummary(machineId?: string, signal?: AbortSignal): Promise<ShiftSummary> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath(),
      query: machineId ? { machine_id: machineId } : undefined,
      signal,
      endpointKey: 'OEE_SHIFT_SUMMARY',
    });
    const { items } = splitList(raw);
    const first = items[0] ?? raw;
    return mapShiftSummary(first, machineId);
  },
  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
    signal?: AbortSignal
  ): Promise<ShiftTimelineSegment[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath(),
        query: { bucket, ...(machineId ? { machine_id: machineId } : {}) },
        signal,
        endpointKey: 'OEE_SHIFT_TIMELINE',
      },
      mapTimelineSegment,
      50,
    ).then((p) => p.data);
  },
  // -- Reconciliation ----------------------------------------------------------
  async getReconciliationJobs(signal?: AbortSignal): Promise<ReconciliationJob[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList<ReconciliationJob>(
      { path: ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath(), signal, endpointKey: 'RECONCILIATION_JOBS', capability: 'telemetry.read' },
      (raw) => mapReconciliationJob(raw),
      50,
    ).then((p) => p.data);
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath(),
      body: {
        ...(request.startWindow ?? request.from ? { startWindow: request.startWindow ?? request.from } : {}),
        ...(request.endWindow ?? request.to ? { endWindow: request.endWindow ?? request.to } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'RECONCILIATION_REFRESH',
      capability: 'export.telemetry',
    });
    return { success: bool(raw.success, true), message: (raw.message as string) ?? 'Refresh reconciliation diterima.' };
  },
  // -- Quality rejects ----------------------------------------------------------
  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId),
      signal,
      endpointKey: 'QUALITY_REJECTS_BY_DEVICE',
      capability: 'quality.read',
      resourceId: deviceId,
    });
    return paretoFromRows(raw);
  },

  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath(),
      signal,
      endpointKey: 'QUALITY_REJECTS_GLOBAL',
      capability: 'quality.read',
    });
    return paretoFromRows(raw);
  },
  // -- IAM (Guide §4.6g: tanpa privilege_level; peran dari server) --------------
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson({ path: ADMIN_ENDPOINTS.IAM_INFO.buildPath(), signal, endpointKey: 'IAM_INFO' }, mapIamInfo);
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath(), signal, endpointKey: 'IAM_ROLES_LIST', capability: 'access_control.manage' },
      mapIamRole,
      100,
    ).then((p) => p.data);
  },

  async createIamRole(data: { name: string; privilege_level?: number; description?: string }): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // Guide §4.6g: body server = {name, description?, reason?} — TANPA
    // privilege_level (hierarki statis dihapus backend-side). Parameter
    // privilege_level diterima agar pemanggil demo tetap typecheck, tapi
    // TIDAK dikirim.
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath(),
        body: { name: data.name.trim(), ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_CREATE',
        capability: 'access_control.manage',
      },
      mapIamRole,
    );
  },
  async updateIamRole(
    roleId: string,
    patch: { description?: string; privilege_level?: number }
  ): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // privilege_level diterima (kompatibilitas demo) tapi tidak dikirim —
    // lihat createIamRole.
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId),
        body: { ...(patch.description !== undefined ? { description: patch.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_UPDATE',
        capability: 'access_control.manage',
        resourceId: roleId,
      },
      mapIamRole,
    );
  },
  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLES_DELETE',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath(), signal, endpointKey: 'IAM_PERMISSIONS_LIST', capability: 'access_control.manage' },
      mapIamPermission,
      100,
    ).then((p) => p.data);
  },

  async createIamPermission(data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath(),
        body: { action: data.action, resource_type: data.resource_type, ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_PERMISSIONS_CREATE',
        capability: 'access_control.manage',
      },
      mapIamPermission,
    );
  },
  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: { resourcePattern?: string; effect?: 'ALLOW' | 'DENY'; abacCondition?: Record<string, unknown> | null; reason?: string }
  ): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_ADD.buildPath(roleId),
      body: {
        permissionId,
        ...(options?.resourcePattern ? { resourcePattern: options.resourcePattern } : {}),
        ...(options?.effect ? { effect: options.effect } : {}),
        ...(options?.abacCondition !== undefined ? { abacCondition: options.abacCondition } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLE_PERMISSIONS_ADD',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },
  async removeIamRolePermission(roleId: string, permissionId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_DELETE.buildPath(roleId, permissionId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLE_PERMISSIONS_DELETE',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async getIamUserRoles(signal?: AbortSignal): Promise<IamAssignment[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath(), signal, endpointKey: 'IAM_USER_ROLES_LIST', capability: 'access_control.manage' },
      mapIamAssignment,
      100,
    ).then((p) => p.data);
  },
  async assignIamUserRole(data: {
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<IamAssignment> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_USER_ROLES_CREATE.buildPath(),
        body: {
          operatorId: data.operatorId,
          roleName: data.roleName,
          scopeType: data.scopeType,
          ...(data.scopeId ? { scopeId: data.scopeId } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_USER_ROLES_CREATE',
        capability: 'access_control.manage',
        resourceId: data.operatorId,
      },
      mapIamAssignment,
    );
  },
  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_USER_ROLES_DELETE.buildPath(),
      body: {
        operatorId: assignment.operatorId,
        roleName: assignment.roleName,
        scopeType: assignment.scopeType,
        ...(assignment.scopeId ? { scopeId: assignment.scopeId } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_USER_ROLES_DELETE',
      capability: 'access_control.manage',
      resourceId: assignment.operatorId,
    });
    return { success: raw?.success ?? true };
  },
  async getIamPolicies(signal?: AbortSignal): Promise<IamPolicyRule[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_POLICIES_LIST.buildPath(), signal, endpointKey: 'IAM_POLICIES_LIST', capability: 'access_control.manage' },
      mapIamPolicy,
      100,
    ).then((p) => p.data);
  },

  async createIamPolicy(data: Omit<IamPolicyRule, 'id'>): Promise<IamPolicyRule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_POLICIES_CREATE.buildPath(),
        body: { ...data },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_POLICIES_CREATE',
        capability: 'access_control.manage',
      },
      mapIamPolicy,
    );
  },
  async updateIamPolicy(
    policyId: string,
    patch: Partial<Pick<IamPolicyRule, 'eft' | 'action' | 'resource_pattern' | 'abac_condition' | 'is_active' | 'reason'>>
  ): Promise<IamPolicyRule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.IAM_POLICIES_UPDATE.buildPath(policyId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_POLICIES_UPDATE',
        capability: 'access_control.manage',
        resourceId: policyId,
      },
      mapIamPolicy,
    );
  },
  async deleteIamPolicy(policyId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_POLICIES_DELETE.buildPath(policyId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_POLICIES_DELETE',
      capability: 'access_control.manage',
      resourceId: policyId,
    });
    return { success: raw?.success ?? true };
  },

  async getSubjectEffectivePermissions(
    operatorId: string,
    signal?: AbortSignal
  ): Promise<IamEffectivePermissions> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.IAM_SUBJECT_EFFECTIVE_PERMISSIONS.buildPath(operatorId),
      signal,
      endpointKey: 'IAM_SUBJECT_EFFECTIVE_PERMISSIONS',
      capability: 'access_control.manage',
      resourceId: operatorId,
    });
    return mapIamSubjectEffectivePermissions(raw, operatorId);
  },
  async getIamAuditDecisions(limit = 100, signal?: AbortSignal): Promise<IamAuditDecision[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.IAM_AUDIT.buildPath(),
        query: { limit, envelope: true },
        signal,
        endpointKey: 'IAM_AUDIT',
        capability: 'access_control.manage',
      },
      mapIamAuditDecision,
      limit,
    ).then((p) => p.data);
  },
  async toggleIamPolicy(policyId: string, isActive: boolean): Promise<IamPolicyRule> {
    return this.updateIamPolicy(policyId, { is_active: isActive });
  },
  // -- MQTT (DynSec + broker config) ------------------------------------------
  async getBrokerOverview(signal?: AbortSignal): Promise<BrokerOverviewInfo> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_OVERVIEW.buildPath(), signal, endpointKey: 'MQTT_OVERVIEW', capability: 'mqtt.overview.read' },
      mapBrokerOverview,
    );
  },
  async getMqttDynamicSecurityStatus(signal?: AbortSignal): Promise<{
    enabled: boolean;
    status: 'CONNECTED' | 'DISCONNECTED';
    clients_count: number;
    roles_count: number;
    groups_count: number;
  }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_STATUS.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_STATUS', capability: 'mqtt.dynsec.read' },
      mapMqttDynsecStatus,
    );
  },
  async getMqttClients(signal?: AbortSignal): Promise<MqttClient[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_CLIENTS_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttClient,
      100,
    ).then((p) => p.data);
  },

  async getMqttClient(username: string, signal?: AbortSignal): Promise<MqttClient> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_GET.buildPath(username), signal, endpointKey: 'MQTT_DYNSEC_CLIENTS_GET', capability: 'mqtt.dynsec.read', resourceId: username },
      mapMqttClient,
    );
  },

  async createMqttClient(data: {
    username: string;
    password?: string;
    clientid?: string;
    textname?: string;
    textdescription?: string;
    roles?: string[];
    groups?: string[];
    deviceId?: string;
    access?: 'publish' | 'subscribe' | 'readwrite';
  }): Promise<{ client: MqttClient; generatedPassword?: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // Backend (Guide §6.x): {username, password, clientid?, roles:[{rolename,
    // priority}]} ATAU {username, password, deviceId, access}. Demo memakai
    // roles: string[] — dipetakan ke {rolename, priority: 1}; access demo
    // dipetakan ke access Guide.
    const accessMap: Record<string, string> = { publish: 'telemetry', subscribe: 'telemetry+state', readwrite: 'telemetry+state' };
    const body: Record<string, unknown> =
      data.roles && data.roles.length > 0
        ? {
            username: data.username.trim(),
            password: data.password ?? '',
            ...(data.clientid ? { clientid: data.clientid } : {}),
            roles: data.roles.map((r) => ({ rolename: r, priority: 1 })),
          }
        : {
            username: data.username.trim(),
            password: data.password ?? '',
            deviceId: data.deviceId,
            access: data.access ? accessMap[data.access] : 'telemetry',
          };
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_CREATE.buildPath(),
      body,
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_CREATE',
      capability: 'mqtt.dynsec.manage',
      resourceId: data.username,
    });
    const client = mapMqttClient(raw.client ?? raw);
    const generatedPassword = (raw.generatedPassword as string | undefined) ?? (raw.password as string | undefined);
    return { client, generatedPassword };
  },
  async deleteMqttClient(username: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_DELETE.buildPath(username),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
    return { success: raw?.success ?? true };
  },

  async rotateMqttClientPassword(username: string, password: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_PASSWORD.buildPath(username),
      body: { password },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENTS_PASSWORD',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
    return { success: raw?.success ?? true };
  },
  async toggleMqttClient(username: string, enabled: boolean): Promise<MqttClient> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_ENABLE.buildPath(username),
        body: { disabled: !enabled },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_CLIENTS_ENABLE',
        capability: 'mqtt.dynsec.manage',
        resourceId: username,
      },
      mapMqttClient,
    );
  },
  async addMqttClientRole(username: string, rolename: string, priority = 1): Promise<MqttClient> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_ADD.buildPath(username),
        body: { roles: [{ rolename, priority }] },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_CLIENT_ROLES_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: username,
      },
      mapMqttClient,
    );
  },
  async removeMqttClientRole(username: string, rolename: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_DELETE.buildPath(username, rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_CLIENT_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: username,
    });
  },
  async getMqttRoles(signal?: AbortSignal): Promise<MqttRole[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_ROLES_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttRole,
      100,
    ).then((p) => p.data);
  },

  async getMqttRole(rolename: string, signal?: AbortSignal): Promise<MqttRole> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_GET.buildPath(rolename), signal, endpointKey: 'MQTT_DYNSEC_ROLES_GET', capability: 'mqtt.dynsec.read', resourceId: rolename },
      mapMqttRole,
    );
  },

  async createMqttRole(role: MqttRole): Promise<MqttRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_CREATE.buildPath(),
        body: {
          rolename: role.rolename.trim(),
          acls: role.acls,
          ...(role.textname ? { textname: role.textname } : {}),
          ...(role.textdescription ? { textdescription: role.textdescription } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_ROLES_CREATE',
        capability: 'mqtt.dynsec.manage',
        resourceId: role.rolename,
      },
      mapMqttRole,
    );
  },
  async deleteMqttRole(rolename: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_DELETE.buildPath(rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: rolename,
    });
    return { success: raw?.success ?? true };
  },

  async addMqttRoleAcl(rolename: string, acl: MqttAcl): Promise<MqttRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_ADD.buildPath(rolename),
        body: { acls: [acl] },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_ROLE_ACLS_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: rolename,
      },
      mapMqttRole,
    );
  },
  async removeMqttRoleAcl(rolename: string, acltype: MqttAcl['acltype'], topic: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_DELETE.buildPath(rolename),
      body: { acltype, topic },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_ROLE_ACLS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: rolename,
    });
  },
  async getMqttGroups(signal?: AbortSignal): Promise<MqttGroup[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_LIST.buildPath(), signal, endpointKey: 'MQTT_DYNSEC_GROUPS_LIST', capability: 'mqtt.dynsec.read' },
      mapMqttGroup,
      100,
    ).then((p) => p.data);
  },

  async getMqttGroup(groupname: string, signal?: AbortSignal): Promise<MqttGroup> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_GET.buildPath(groupname), signal, endpointKey: 'MQTT_DYNSEC_GROUPS_GET', capability: 'mqtt.dynsec.read', resourceId: groupname },
      mapMqttGroup,
    );
  },

  async createMqttGroup(group: MqttGroup): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_CREATE.buildPath(),
        body: {
          groupname: group.groupname.trim(),
          ...(group.textname ? { textname: group.textname } : {}),
          ...(group.textdescription ? { textdescription: group.textdescription } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUPS_CREATE',
        capability: 'mqtt.dynsec.manage',
        resourceId: group.groupname,
      },
      mapMqttGroup,
    );
  },
  async deleteMqttGroup(groupname: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_DELETE.buildPath(groupname),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUPS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
    return { success: raw?.success ?? true };
  },

  async addMqttGroupClient(groupname: string, username: string): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_ADD.buildPath(groupname),
        body: { clients: [{ username }] },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUP_CLIENTS_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: groupname,
      },
      mapMqttGroup,
    );
  },
  async removeMqttGroupClient(groupname: string, username: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_DELETE.buildPath(groupname, username),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUP_CLIENTS_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
  },
  async addMqttGroupRole(groupname: string, rolename: string): Promise<MqttGroup> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_ADD.buildPath(groupname),
        body: { roles: [{ rolename }] },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MQTT_DYNSEC_GROUP_ROLES_ADD',
        capability: 'mqtt.dynsec.manage',
        resourceId: groupname,
      },
      mapMqttGroup,
    );
  },
  async removeMqttGroupRole(groupname: string, rolename: string): Promise<void> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    await reqJson<unknown>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_DELETE.buildPath(groupname, rolename),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_DYNSEC_GROUP_ROLES_DELETE',
      capability: 'mqtt.dynsec.manage',
      resourceId: groupname,
    });
  },
  async getBrokerConfig(signal?: AbortSignal): Promise<BrokerConfigSchema> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_GET.buildPath(), signal, endpointKey: 'MQTT_CONFIG_GET', capability: 'mqtt.config.read' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const general = (r.general ?? {}) as Record<string, unknown>;
        const limits = (r.limits ?? {}) as Record<string, unknown>;
        return {
          version: str(pick(r.version), '1'),
          general: {
            per_listener_settings: bool(general.per_listener_settings, false),
            allow_anonymous: bool(general.allow_anonymous, false),
            autosave_interval_seconds: num(general.autosave_interval_seconds, 300),
            persistence: bool(general.persistence, true),
            persistence_location: str(general.persistence_location, ''),
            log_dest: (general.log_dest as string[]) ?? [],
            log_type: (general.log_type as string[]) ?? [],
            connection_messages: bool(general.connection_messages, true),
          },
          limits: {
            max_connections: num(limits.max_connections, 1000),
            max_packet_size_bytes: num(limits.max_packet_size_bytes, 268435456),
            max_queued_messages: num(limits.max_queued_messages, 1000),
            max_queued_bytes: num(limits.max_queued_bytes, 0),
            max_inflight_messages: num(limits.max_inflight_messages, 20),
          },
          listeners: (r.listeners as BrokerConfigSchema['listeners']) ?? [],
          tls_profiles: (r.tls_profiles as BrokerConfigSchema['tls_profiles']) ?? [],
          bridges: (r.bridges as BrokerConfigSchema['bridges']) ?? [],
        };
      },
    );
  },
  async getBrokerConfigRaw(signal?: AbortSignal): Promise<string> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await fetchRaw({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_RAW.buildPath(),
      signal,
      endpointKey: 'MQTT_CONFIG_RAW',
    });
    calledKeys.add('MQTT_CONFIG_RAW');
    return raw.text;
  },
  async getBrokerConfigStatus(signal?: AbortSignal): Promise<{
    active_version: string;
    sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
    last_applied_at: string;
    mutation_locked: boolean;
  }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath(), signal, endpointKey: 'MQTT_CONFIG_STATUS', capability: 'mqtt.config.read' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          active_version: str(pick(r.active_version, r.activeVersionId, r.activeVersion), ''),
          sync_state: (pick(r.sync_state, r.syncState, r.status, 'IN_SYNC') as 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED'),
          last_applied_at: iso(pick(r.last_applied_at, r.lastAppliedAt)),
          mutation_locked: bool(pick(r.mutation_locked, r.mutationLocked), false),
        };
      },
    );
  },
  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath(),
      body: { config: newConfig, summary },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_STAGE',
      capability: 'mqtt.config.manage',
    });
    return mapBrokerConfigVersion(raw.version ?? raw);
  },
  async getBrokerConfigVersions(limit = 100, signal?: AbortSignal): Promise<BrokerConfigVersion[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_LIST.buildPath(), query: { limit }, signal, endpointKey: 'MQTT_CONFIG_LIST', capability: 'mqtt.config.read' },
      mapBrokerConfigVersion,
      limit,
    ).then((p) => p.data);
  },
  async getBrokerConfigVersion(versionId: string, signal?: AbortSignal): Promise<BrokerConfigVersion> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_GET.buildPath(versionId), signal, endpointKey: 'MQTT_CONFIG_VERSION_GET', capability: 'mqtt.config.read', resourceId: versionId },
      mapBrokerConfigVersion,
    );
  },

  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<{ version_id: string; diff_summary: string; changed_keys: string[] }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId),
      signal,
      endpointKey: 'MQTT_CONFIG_VERSION_DIFF',
      capability: 'mqtt.config.read',
      resourceId: versionId,
    });
    return {
      version_id: str(pick(raw.version_id, raw.versionId, versionId)),
      diff_summary: str(pick(raw.diff_summary, raw.diffSummary, raw.summary), ''),
      changed_keys: ((raw.changed_keys ?? raw.changedKeys ?? []) as unknown[]).map((k) => String(k)),
    };
  },
  async deleteBrokerConfigVersion(versionId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DELETE.buildPath(versionId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_DELETE',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
    });
    return { success: raw?.success ?? true };
  },

  async applyBrokerConfigVersion(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_APPLY.buildPath(versionId),
      body: { confirm: options.confirm ?? true, ...(options.reason ? { reason: options.reason } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_APPLY',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
    });
    return {
      version: mapBrokerConfigVersion(raw.version ?? raw),
      operation: mapBrokerOperation(raw.operation ?? raw),
    };
  },

  async applyBrokerConfig(newConfig: BrokerConfigSchema, summary: string, reason?: string): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const staged = await this.stageBrokerConfig(newConfig, summary);
    return this.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary });
  },
  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_ROLLBACK.buildPath(versionId),
      body: { confirm: options.confirm ?? true, ...(options.reason ? { reason: options.reason } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_ROLLBACK',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
    });
    return {
      version: mapBrokerConfigVersion(raw.version ?? raw),
      operation: mapBrokerOperation(raw.operation ?? raw),
    };
  },

  async getBrokerConfigOperations(limit = 50, signal?: AbortSignal): Promise<BrokerOperation[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATIONS.buildPath(), query: { limit }, signal, endpointKey: 'MQTT_CONFIG_OPERATIONS', capability: 'mqtt.config.read' },
      mapBrokerOperation,
      limit,
    ).then((p) => p.data);
  },
  async getBrokerConfigOperation(operationId: string, signal?: AbortSignal): Promise<BrokerOperation | null> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    try {
      return await reqJson(
        { path: ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATION_GET.buildPath(operationId), signal, endpointKey: 'MQTT_CONFIG_OPERATION_GET', capability: 'mqtt.config.read', resourceId: operationId },
        mapBrokerOperation,
      );
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 404) return null;
      throw err;
    }
  },
  async getBrokerConfigBackups(signal?: AbortSignal): Promise<BrokerBackup[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList<BrokerBackup>(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath(), signal, endpointKey: 'MQTT_CONFIG_BACKUPS', capability: 'mqtt.config.read' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          backup_id: str(pick(r.backup_id, r.backupId, r.id)),
          filename: str(pick(r.filename, r.name)),
          version_id: str(pick(r.version_id, r.versionId)),
          created_at: iso(pick(r.created_at, r.createdAt)),
          size_bytes: num(pick(r.size_bytes, r.sizeBytes), 0),
        } satisfies BrokerBackup;
      },
      50,
    ).then((p) => p.data);
  },

  async createBrokerConfigBackup(): Promise<{ success: boolean; versionId?: string; name?: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath(),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_BACKUPS',
      capability: 'mqtt.config.manage',
    });
    return {
      success: bool(raw.success, true),
      versionId: raw.versionId ? String(raw.versionId) : raw.id ? String(raw.id) : undefined,
      name: raw.name ? String(raw.name) : undefined,
    };
  },
};
