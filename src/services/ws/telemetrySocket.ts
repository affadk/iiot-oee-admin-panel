import { MachineFsmState } from '../../types/monitoring';
import { normalizeFsmState } from '../../utils/oeeCalculations';

/**
 * Build Guide §10 & API Doc §4/§7.A — Singleton Real-Time WebSocket Client (/ws/telemetry)
 * - Single shared connection per browser session (no Bearer header — origin + perimeter guarded)
 * - Application-level heartbeat: sends text "ping", handles text "pong"
 * - Ignores unknown event types safely without dropping connection
 * - Ignores `is_buffered: true` payloads for live telemetry state
 * - Exponential backoff 1s -> 30s; closes 4403 (forbidden origin) / 4429 (rate limit) handled gracefully
 * - Triggers snapshot live-state refetch callback upon reconnect
 */

export type WsConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RATE_LIMITED' | 'FORBIDDEN_ORIGIN';

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

export interface TelemetryWsLifecycleEvent {
  type:
    | 'HEALTH_UPDATE'
    | 'DEVICE_STATUS_UPDATE'
    | 'DEVICE_EVENT'
    | 'DOWNTIME_STARTED'
    | 'DOWNTIME_ENDED'
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

export type TelemetryWsEvent = TelemetryWsTelemetryEvent | TelemetryWsLifecycleEvent;

export const KNOWN_WS_TYPES = new Set([
  'TELEMETRY_UPDATE',
  'HEALTH_UPDATE',
  'DEVICE_STATUS_UPDATE',
  'DEVICE_EVENT',
  'DOWNTIME_STARTED',
  'DOWNTIME_ENDED',
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

export function resolveWsUrl(): string {
  const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_WS_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/telemetry`;
  }
  return 'ws://localhost/ws/telemetry';
}

class TelemetrySocketSingleton {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'DISCONNECTED';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners = new Set<(event: TelemetryWsEvent) => void>();
  private statusListeners = new Set<(status: WsConnectionStatus) => void>();
  private reconnectHandlers = new Set<() => void>();

  getStatus(): WsConnectionStatus {
    return this.status;
  }

  connect(onReconnectRefetch?: () => void): void {
    if (onReconnectRefetch) {
      this.reconnectHandlers.add(onReconnectRefetch);
    }
    if (typeof WebSocket === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');
    try {
      const url = resolveWsUrl();
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        const wasReconnect = this.reconnectAttempt > 0;
        this.reconnectAttempt = 0;
        this.setStatus('CONNECTED');
        this.startHeartbeat();
        if (wasReconnect) {
          this.reconnectHandlers.forEach((cb) => cb());
        }
      };

      socket.onmessage = (evt) => {
        if (typeof evt.data !== 'string') return;
        const frame = parseWsIncomingFrame(evt.data);
        if (!frame || frame === 'pong') return;
        this.eventListeners.forEach((cb) => cb(frame));
      };

      socket.onclose = (evt) => {
        this.stopHeartbeat();
        this.ws = null;
        if (evt.code === 4403) {
          this.setStatus('FORBIDDEN_ORIGIN');
          return;
        }
        if (evt.code === 4429) {
          this.setStatus('RATE_LIMITED');
          this.scheduleReconnect(30_000);
          return;
        }
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // Handled via onclose backoff
      };
    } catch {
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  subscribe(listener: (event: TelemetryWsEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  emitLifecycleEvent(
    type: TelemetryWsLifecycleEvent['type'],
    payload: Record<string, unknown>,
    timestampIso: string = new Date().toISOString()
  ): void {
    if (!KNOWN_WS_TYPES.has(type)) return;
    const event: TelemetryWsLifecycleEvent = {
      type,
      payload: { type, timestamp: timestampIso, ...payload },
      timestampIso,
    };
    this.eventListeners.forEach((cb) => cb(event));
  }

  subscribeStatus(listener: (status: WsConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(next: WsConnectionStatus): void {
    this.status = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25_000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(explicitDelayMs?: number): void {
    if (this.reconnectTimer || this.eventListeners.size === 0) return;
    const delayMs =
      explicitDelayMs ?? Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.eventListeners.size > 0) {
        this.connect();
      }
    }, delayMs);
  }
}

export const telemetrySocket = new TelemetrySocketSingleton();
