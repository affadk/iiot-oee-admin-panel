/**
 * Method HTTP — domain health.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { reqJson, checkAbortHttp } from './transport';
import { num, str, bool, iso, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { resolveWsUrl } from '../mode';
import { SystemHealth } from '../../../types/system';

export const httpHealth = {
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
  }
};
