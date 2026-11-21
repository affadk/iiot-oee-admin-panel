import type { OperationalEvent } from './monitoring';

/**
 * E20 P20.4 (FAT-156): `/health` mengembalikan bentuk lean (API doc §A) —
 * tanpa label/version/environment/latency per komponen. Nilai yang tidak
 * tersedia = null/UNKNOWN, bukan 0/'UP' — sintesis lama (`label 'API v1'`,
 * `environment 'production'`, latency 0, mqtt 'UP', `connected_clients`
 * fallback ke wsClients, `dynamic_security 'enabled'`) dihapus.
 */
export interface SystemHealth {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  /** Detik sejak backend start (alias numerik dari `uptime`). */
  uptime_seconds: number;
  timestamp: string;
  ws_clients: number;
  db_connected: boolean;
  buffer_pending: number;
  buffer_dropped: number;
  backend: {
    status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
    label: string | null;
    environment: string | null;
    latency_ms: number | null;
  };
  database: {
    engine: string | null;
    latency_ms: number | null;
  };
  mqtt: {
    status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
    connected_clients: number | null;
    dynamic_security: string | null;
  };
  websocket: {
    status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  };
  metrics: {
    totalReceived: number;
    validIngested: number;
    invalidDiscarded: number;
    lastIngestedAt: string | null;
  } | null;
}

/**
 * E20 P20.4 (FAT-156): `GET /health/detail` (API doc §A) — status terukur
 * per komponen + identitas runtime, ADMIN + LAN, grant `read` pada
 * `access_control`. Setiap komponen membawa `measuredAt` sendiri; nilai
 * tidak tersedia = null/UNKNOWN, bukan 0/'UP'.
 *
 * E23 Batch 2 (FAT-189, N-20): + `DEGRADED` — spec live enum status
 * database/mqtt `UP|DEGRADED|DOWN|UNKNOWN` (aplikasi/websocket di spec
 * hanya `UP|DOWN`; DEGRADED di tipe ini superset toleran). Dulu panel
 * memetakan DEGRADED → 'UNKNOWN' sehingga degradasi tak terlihat.
 */
export type HealthDetailStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface HealthDetail {
  measuredAt: string | null;
  application: {
    status: HealthDetailStatus;
    name: string | null;
    version: string | null;
    environment: string | null;
    commit: string | null;
    uptimeSeconds: number | null;
    measuredAt: string | null;
  };
  database: {
    status: HealthDetailStatus;
    /** Terukur nyata di sekitar `SELECT 1`; gagal/timeout → null. */
    latencyMs: number | null;
    measuredAt: string | null;
  };
  mqtt: {
    status: HealthDetailStatus;
    // E23 Batch 2 (FAT-189, N-20): spec live `adminConnection` boleh
    // null — biarkan null (jangan fabrikasi objek berisi null).
    adminConnection: {
      /** Koneksi admin DynSec, bukan liveness broker. */
      connected: boolean | null;
      pluginReady: boolean | null;
      lastError: string | null;
      lastConnectedAt: string | null;
    } | null;
    /** Dari daftar klien DynSec; null bila tidak tersedia. */
    clientsCount: number | null;
    measuredAt: string | null;
  };
  websocket: {
    status: HealthDetailStatus;
    clients: number | null;
    measuredAt: string | null;
  };
}

/**
 * E20 P20.4 (FAT-156): `/system/audit` adalah alias audit trail global yang
 * mengembalikan `OperationalEventItem[]` (API doc §I) — bentuknya SAMA
 * dengan OperationalEvent FR-034-01. Field karangan lama (`operator_id`,
 * `operator_name`, `action`, `resource_type`, `resource_id`, `client_ip`,
 * `access_mode`) dihapus; yang benar-benar ada adalah `acknowledgedBy`,
 * `ackNote`, `triggerSource`, `woId`, dst.
 */
export type AuditLogItem = OperationalEvent;

/**
 * E20 P20.5 (FAT-157): `GET /api/v1/system/access-mode` (pembaruan api_docs
 * 19 Nov 09:23) — nilai server untuk read-only vs read-write. JWT wajib.
 * Panel memakai nilai ini bila tersedia (prefer server); bila endpoint tak
 * tersedia (404/401 backend lama), fallback ke derivasi env+kanal
 * (mode.ts / NetworkAccessContext). HANYA konsumsi sisi panel — A10.2
 * keseluruhan BELUM terbuka (middleware enforcement server-side masih
 * menunggu backend).
 */
export interface SystemAccessMode {
  mode: 'private' | 'public';
  channel: 'lan' | 'tunnel' | 'unknown';
  mutations_allowed: boolean;
}
