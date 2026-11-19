/**
 * Method HTTP — domain health.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 *
 * E20 P20.4 (FAT-156): sintesis lama dihapus — `/health` mengembalikan bentuk
 * lean (API doc §A) tanpa label/version/environment/latency per komponen;
 * nilai yang tidak tersedia = null/UNKNOWN, bukan 0/'UP'. Tidak ada lagi
 * fabrikasi: label 'API v1', environment 'production', latency 0, mqtt 'UP',
 * `connected_clients` fallback ke wsClients, `dynamic_security 'enabled'`.
 */
import { reqJson, checkAbortHttp, assertAuthenticatedHttp } from './transport';
import { num, bool, iso, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { resolveWsUrl } from '../mode';
import { HealthDetail, SystemHealth } from '../../../types/system';

function detailStatus(v: unknown): HealthDetail['application']['status'] {
  // E23 Batch 2 (FAT-189, N-20): spec live enum database/mqtt
  // `UP|DEGRADED|DOWN|UNKNOWN` — DEGRADED diteruskan apa adanya (dulu
  // jatuh ke 'UNKNOWN' sehingga degradasi tak terlihat).
  return v === 'UP' || v === 'DEGRADED' || v === 'DOWN' ? v : 'UNKNOWN';
}

function nullableNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function nullableStr(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

function nullableBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function nullableIso(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

export function mapHealthDetail(raw: unknown): HealthDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const app = (r.application ?? {}) as Record<string, unknown>;
  const db = (r.database ?? {}) as Record<string, unknown>;
  const mqtt = (r.mqtt ?? {}) as Record<string, unknown>;
  // E23 Batch 2 (FAT-189, N-20): spec live `adminConnection` boleh null —
  // null/absen → null (dulu selalu difabrikasi objek berisi null).
  const adminRaw = pick(mqtt.adminConnection, mqtt.admin_connection);
  const adminConn = (adminRaw && typeof adminRaw === 'object' ? adminRaw : null) as Record<string, unknown> | null;
  const ws = (r.websocket ?? {}) as Record<string, unknown>;
  return {
    measuredAt: nullableIso(pick(r.measuredAt, r.measured_at)),
    application: {
      status: detailStatus(app.status),
      name: nullableStr(pick(app.name)),
      version: nullableStr(pick(app.version)),
      environment: nullableStr(pick(app.environment)),
      commit: nullableStr(pick(app.commit)),
      uptimeSeconds: nullableNum(pick(app.uptimeSeconds, app.uptime_seconds)),
      measuredAt: nullableIso(pick(app.measuredAt, app.measured_at)),
    },
    database: {
      status: detailStatus(db.status),
      latencyMs: nullableNum(pick(db.latencyMs, db.latency_ms)),
      measuredAt: nullableIso(pick(db.measuredAt, db.measured_at)),
    },
    mqtt: {
      status: detailStatus(mqtt.status),
      adminConnection: adminConn
        ? {
            connected: nullableBool(pick(adminConn.connected)),
            pluginReady: nullableBool(pick(adminConn.pluginReady, adminConn.plugin_ready)),
            lastError: nullableStr(pick(adminConn.lastError, adminConn.last_error)),
            lastConnectedAt: nullableIso(pick(adminConn.lastConnectedAt, adminConn.last_connected_at)),
          }
        : null,
      clientsCount: nullableNum(pick(mqtt.clientsCount, mqtt.clients_count)),
      measuredAt: nullableIso(pick(mqtt.measuredAt, mqtt.measured_at)),
    },
    websocket: {
      status: detailStatus(ws.status),
      clients: nullableNum(pick(ws.clients)),
      measuredAt: nullableIso(pick(ws.measuredAt, ws.measured_at)),
    },
  };
}

export const httpHealth = {
  // -- Health & WS ----------------------------------------------------------
  async getSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
    checkAbortHttp(signal);
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.HEALTH.buildPath(),
      signal,
      endpointKey: 'HEALTH',
    });
    // Backend /health mengembalikan bentuk lean (API doc §A) — tanpa
    // label/version/environment/latency per komponen. Yang tidak dikirim
    // tampil null/UNKNOWN; tidak ada nilai yang dikarang di sini.
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
        status: detailStatus(pick(backend.status)),
        label: nullableStr(pick(backend.label)),
        environment: nullableStr(pick(backend.environment)),
        latency_ms: nullableNum(pick(backend.latency_ms, backend.latencyMs)),
      },
      database: {
        engine: nullableStr(pick(database.engine)),
        latency_ms: nullableNum(pick(database.latency_ms, database.latencyMs)),
      },
      mqtt: {
        status: detailStatus(pick(mqtt.status)),
        connected_clients: nullableNum(pick(mqtt.connected_clients, mqtt.connectedClients)),
        dynamic_security: nullableStr(pick(mqtt.dynamic_security, mqtt.dynamicSecurity)),
      },
      websocket: {
        status: detailStatus(pick(websocket.status)),
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

  /**
   * E20 P20.4 (FAT-156): GET /health/detail (API doc §A) — ADMIN + LAN,
   * grant `read` pada `access_control`. 401/403 dari server diteruskan
   * sebagai ApiError; pemanggil menangkapnya dan memakai /health ringkas.
   */
  async getHealthDetail(signal?: AbortSignal): Promise<HealthDetail> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      {
        path: ADMIN_ENDPOINTS.HEALTH_DETAIL.buildPath(),
        signal,
        endpointKey: 'HEALTH_DETAIL',
        capability: 'access_control.read',
      },
      mapHealthDetail,
    );
  },

  getTelemetryWebSocketUrl(): string {
    return resolveWsUrl();
  }
};
