/**
 * Frame WebSocket telemetri — tipe event + parser frame masuk.
 *
 * Dipisah dari services/ws/telemetrySocket.ts pada refactoring E31.16
 * (FAT-279, audit P3-2): parser bisa diuji tanpa socket. Dipakai
 * telemetrySocket (client) + pemeta health (mappers/assets).
 */
import { MachineFsmState } from '../../types/monitoring';
import { normalizeFsmState } from '../../utils/oeeCalculations';

export interface TelemetryWsTelemetryEvent {
  type: 'TELEMETRY_UPDATE';
  device_id: string;
  machine_id: string | null;
  fsm_state?: MachineFsmState;
  is_buffered: boolean;
  timestampIso: string;
  counters?: { total: number; good: number; reject: number; last_cycle_sec?: number };
  oee?: { availability: number; performance: number; quality: number; total_oee: number };
  plc_modbus?: { spindle_rpm?: number; temp_c?: number; alarm_code?: number };
}

export interface TelemetryWsHealthData {
  heapFree: number;
  tasksHealthy: number;
  tasksTotal: number;
  staleTasks: string[];
  staleCount: number;
  /** Bitmask angka (12-bit firmware) atau array string — didekode mapper. */
  eventFlags: number | string[];
}

/**
 * FAT-261: HEALTH_UPDATE sebagai event bertipe sendiri (bukan lifecycle
 * mentah) — panel akhirnya mengonsumsinya. Bentuk frame: Build Guide §10 /
 * API doc §7.A + observasi live 20 Nov 2026 (HEALTH_UPDATE tiap ~5 dtk).
 */
export interface TelemetryWsHealthEvent {
  type: 'HEALTH_UPDATE';
  device_id: string;
  timestampIso: string;
  data: TelemetryWsHealthData;
}

export interface TelemetryWsLifecycleEvent {
  type:
    | 'DEVICE_STATUS_UPDATE'
    | 'DEVICE_EVENT'
    // E20 P20.5 (FAT-157): nama event kanonis §7G.
    | 'DOWNTIME_EVENT_OPENED'
    | 'DOWNTIME_EVENT_CLOSED'
    | 'DOWNTIME_REASON_LABELED'
    | 'MACHINE_CREATED'
    | 'MACHINE_UPDATED'
    | 'MACHINE_DELETED'
    | 'MACHINE_BOUND'
    | 'MACHINE_UNBOUND'
    | 'PRODUCT_CREATED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_DELETED'
    | 'PRODUCTION_LINE_CREATED'
    | 'PRODUCTION_LINE_UPDATED'
    | 'PRODUCTION_LINE_DELETED'
    | 'SHIFT_CREATED'
    | 'SHIFT_UPDATED'
    | 'SHIFT_DELETED'
    | 'SHIFT_SCHEDULE_CREATED'
    | 'SHIFT_SCHEDULE_UPDATED'
    | 'SHIFT_SCHEDULE_DELETED'
    | 'WORK_ORDER_CANCELLED'
    | 'WORK_ORDER_COMPLETED';
  payload: Record<string, unknown>;
  timestampIso: string;
}

export type TelemetryWsEvent = TelemetryWsTelemetryEvent | TelemetryWsHealthEvent | TelemetryWsLifecycleEvent;

export const KNOWN_WS_TYPES = new Set([
  'TELEMETRY_UPDATE',
  'HEALTH_UPDATE',
  'DEVICE_STATUS_UPDATE',
  'DEVICE_EVENT',
  'DOWNTIME_EVENT_OPENED',
  'DOWNTIME_EVENT_CLOSED',
  'DOWNTIME_REASON_LABELED',
  'MACHINE_CREATED',
  'MACHINE_UPDATED',
  'MACHINE_DELETED',
  'MACHINE_BOUND',
  'MACHINE_UNBOUND',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
  'PRODUCTION_LINE_CREATED',
  'PRODUCTION_LINE_UPDATED',
  'PRODUCTION_LINE_DELETED',
  'SHIFT_CREATED',
  'SHIFT_UPDATED',
  'SHIFT_DELETED',
  'SHIFT_SCHEDULE_CREATED',
  'SHIFT_SCHEDULE_UPDATED',
  'SHIFT_SCHEDULE_DELETED',
  'WORK_ORDER_CANCELLED',
  'WORK_ORDER_COMPLETED',
]);

export function normalizeWsTimestamp(rawTs: unknown): string {
  if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
    // Unix seconds vs milliseconds
    const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    return new Date(ms).toISOString();
  }
  if (typeof rawTs === 'string' && rawTs.trim().length > 0) {
    const parsed = new Date(rawTs);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function parseWsIncomingFrame(rawData: string): TelemetryWsEvent | 'pong' | null {
  if (rawData === 'pong') return 'pong';

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    return null;
  }

  const type = typeof parsed.type === 'string' ? parsed.type : undefined;
  if (!type) return null;

  if (!KNOWN_WS_TYPES.has(type)) {
    // §10: Ignore unknown message types without closing connection
    return null;
  }

  if (type === 'TELEMETRY_UPDATE') {
    const data = (parsed.data as Record<string, unknown>) ?? parsed;
    const isBuffered = Boolean(data.is_buffered ?? parsed.is_buffered ?? false);
    if (isBuffered) {
      // §10: Backlog historical telemetry MUST NOT overwrite live dashboard KPIs
      return null;
    }

    const counters = (data.counters as Record<string, unknown>) ?? undefined;
    const oee = (data.oee as Record<string, unknown>) ?? undefined;
    const plc = (data.plc_modbus as Record<string, unknown>) ?? undefined;
    const rawState = typeof data.fsm_state === 'string' ? data.fsm_state : undefined;

    return {
      type: 'TELEMETRY_UPDATE',
      device_id: String(parsed.device_id ?? data.device_id ?? ''),
      machine_id: (parsed.machine_id ?? data.machine_id ?? null) as string | null,
      fsm_state: rawState ? normalizeFsmState(rawState) : undefined,
      is_buffered: false,
      timestampIso: normalizeWsTimestamp(data.timestamp ?? parsed.received_at),
      counters: counters
        ? {
            total: Number(counters.total ?? 0),
            good: Number(counters.good ?? 0),
            reject: Number(counters.reject ?? 0),
            last_cycle_sec:
              counters.last_cycle_sec !== undefined ? Number(counters.last_cycle_sec) : undefined,
          }
        : undefined,
      oee: oee
        ? {
            availability: Number(oee.availability ?? 0),
            performance: Number(oee.performance ?? 0),
            quality: Number(oee.quality ?? 0),
            total_oee: Number(oee.total_oee ?? 0),
          }
        : undefined,
      plc_modbus: plc
        ? {
            spindle_rpm: plc.spindle_rpm !== undefined ? Number(plc.spindle_rpm) : undefined,
            temp_c: plc.temp_c !== undefined ? Number(plc.temp_c) : undefined,
            alarm_code: plc.alarm_code !== undefined ? Number(plc.alarm_code) : undefined,
          }
        : undefined,
    };
  }

  // FAT-261: HEALTH_UPDATE diparse bertipe (bukan lifecycle mentah) agar
  // panel bisa mengonsumsinya. Frame tak valid diabaikan (fail-soft) —
  // koneksi WS tidak boleh putus karena satu frame health rusak.
  if (type === 'HEALTH_UPDATE') {
    const data = parsed.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const deviceId = String(parsed.device_id ?? data.device_id ?? '').trim();
    if (!deviceId) return null;
    const num = (v: unknown, fallback = 0): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const rawFlags = data.event_flags ?? data.eventFlags;
    const rawStale = data.stale_tasks ?? data.staleTasks;
    return {
      type: 'HEALTH_UPDATE',
      device_id: deviceId,
      // Timestamp frame (ISO, presisi ms) diutamakan — konsisten dengan
      // fallback lifecycle; data.timestamp (epoch detik) hanya cadangan.
      timestampIso: normalizeWsTimestamp(parsed.timestamp ?? data.timestamp),
      data: {
        heapFree: num(data.heap_free ?? data.heapFree, 0),
        tasksHealthy: num(data.tasks_healthy ?? data.tasksHealthy, 0),
        tasksTotal: num(data.tasks_total ?? data.tasksTotal, 0),
        staleTasks: Array.isArray(rawStale)
          ? rawStale.filter((x): x is string => typeof x === 'string')
          : [],
        staleCount: num(data.stale_count ?? data.staleCount, 0),
        eventFlags: Array.isArray(rawFlags) ? rawFlags.map((x) => String(x)) : num(rawFlags, 0),
      },
    };
  }

  const tsCandidate =
    parsed.timestamp ??
    parsed.received_at ??
    parsed.endTime ??
    parsed.startTime ??
    (parsed.data as Record<string, unknown> | undefined)?.timestamp;

  return {
    type: type as TelemetryWsLifecycleEvent['type'],
    payload: parsed,
    timestampIso: normalizeWsTimestamp(tsCandidate),
  };
}
