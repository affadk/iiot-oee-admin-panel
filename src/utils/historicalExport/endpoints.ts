import {
  DowntimeExportQuery,
  DowntimeHistoryQuery,
  OperationalEventsExportQuery,
  OperationalEventsQuery,
  SystemAuditExportQuery,
  TelemetryExportQuery,
  TelemetryHistoryQuery,
  WorkOrdersQuery,
} from '../../types/historical';
import { TelemetryRollupQuery } from '../../types/analytics';
// E12 T12.8 (F-9 / FAT-61): builder telemetry mendelegasikan path ke registry
// (ADMIN_ENDPOINTS) — satu sumber kebenaran path, sesuai kontrak
// docs/DIRECTORY_STRUCTURE.md §4 aturan 6. Builder di sini hanya menambah
// query string di atas path registry; template path tidak lagi diduplikasi.
// Arah impor: utils/historicalExport → services/api/endpoints (barrel) →
// services/api/endpoints/telemetry → definition. Tidak ada siklus: registry
// endpoint tidak mengimpor apa pun dari utils/ maupun dari demo/http.
import { ADMIN_ENDPOINTS } from '../../services/api/endpoints';

function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      sp.set(k, String(v));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function buildWorkOrdersEndpoint(query: WorkOrdersQuery = {}): string {
  const qs = buildQueryString({
    wo_id: query.wo_id,
    status: query.status,
    machine_id: query.machine_id,
    product_id: query.product_id,
    operator_id: query.operator_id,
    from: query.from,
    to: query.to,
    limit: query.limit,
    cursor: query.cursor,
    envelope: query.envelope ?? true,
  });
  return `/api/v1/work-orders${qs}`;
}

export function buildDowntimeHistoryEndpoint(query: DowntimeHistoryQuery): string {
  const deviceId = encodeURIComponent(query.device_id);
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    category: query.category,
    unlabeled_only: query.unlabeled_only ? 'true' : undefined,
    active_only: query.active_only ? 'true' : undefined,
    cursor: query.cursor,
    limit: query.limit,
    envelope: query.envelope ?? true,
  });
  return `/api/v1/downtime-events/${deviceId}${qs}`;
}

export function buildDowntimeExportEndpoint(query: DowntimeExportQuery): string {
  const deviceId = encodeURIComponent(query.device_id);
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    category: query.category,
    unlabeled_only: query.unlabeled_only ? 'true' : undefined,
    active_only: query.active_only ? 'true' : undefined,
    format: query.format,
    limit: query.limit,
  });
  return `/api/v1/downtime-events/${deviceId}/export${qs}`;
}

/**
 * E20 P20.4 (FAT-156, O4/O13/R9, D-12): hanya kirim parameter terdaftar
 * `GET /operational-events` (from, to, event_type, acknowledged, limit,
 * cursor, envelope) — tanpa trailing slash, tanpa `machine_id` (hanya
 * /system/audit), tanpa `severity`. Filter `acknowledged` yang sebelumnya
 * dibuang kini dikirim.
 */
export function buildOperationalEventsEndpoint(query: OperationalEventsQuery): string {
  const isGlobal = !query.device_id || query.device_id === 'ALL';
  const base = isGlobal
    ? '/api/v1/operational-events'
    : `/api/v1/operational-events/${encodeURIComponent(query.device_id!)}`;
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    event_type: query.event_type,
    acknowledged: query.acknowledged !== undefined ? String(query.acknowledged) : undefined,
    cursor: query.cursor,
    limit: query.limit,
    envelope: query.envelope ?? true,
  });
  return `${base}${qs}`;
}

/**
 * E20 P20.4 (FAT-156, O8/O13, D-12): `GET /operational-events/export` hanya
 * mendaftarkan `from, to, format, limit` — tanpa `machine_id`/`event_type`.
 */
export function buildOperationalEventsExportEndpoint(query: OperationalEventsExportQuery): string {
  const isGlobal = !query.device_id || query.device_id === 'ALL';
  const base = isGlobal
    ? '/api/v1/operational-events/export'
    : `/api/v1/operational-events/${encodeURIComponent(query.device_id!)}/export`;
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    format: query.format,
    limit: query.limit,
  });
  return `${base}${qs}`;
}

/**
 * E20 P20.4 (FAT-156, O9): `GET /system/audit/export` — filter sama dengan
 * daftar (`from`, `to`, `event_type`, `machine_id`).
 */
export function buildSystemAuditExportEndpoint(query: SystemAuditExportQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    event_type: query.event_type,
    machine_id: query.machine_id,
    format: query.format,
    limit: query.limit,
  });
  return `/api/v1/system/audit/export${qs}`;
}

export function buildTelemetryHistoryEndpoint(query: TelemetryHistoryQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    is_buffered: query.is_buffered !== undefined ? String(query.is_buffered) : undefined,
    cursor: query.cursor,
    limit: query.limit,
    envelope: query.envelope ?? true,
  });
  return `${ADMIN_ENDPOINTS.TELEMETRY_HISTORY.buildPath(query.device_id)}${qs}`;
}

export function buildTelemetryRollupEndpoint(query: TelemetryRollupQuery): string {
  const qs = buildQueryString({
    group_by: query.group_by,
    machine_id: query.machine_id,
    device_id: query.device_id,
    from: query.from,
    to: query.to,
    limit: query.limit,
    cursor: query.cursor,
    envelope: query.envelope ?? true,
  });
  return `${ADMIN_ENDPOINTS.TELEMETRY_ROLLUP.buildPath()}${qs}`;
}

export function buildTelemetryExportEndpoint(query: TelemetryExportQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    format: query.format,
    limit: query.limit,
  });
  return `${ADMIN_ENDPOINTS.TELEMETRY_EXPORT.buildPath(query.device_id)}${qs}`;
}

export function buildTelemetryHourlyExportEndpoint(query: TelemetryExportQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    format: query.format,
    limit: query.limit,
  });
  return `${ADMIN_ENDPOINTS.TELEMETRY_HOURLY_EXPORT.buildPath(query.device_id)}${qs}`;
}
