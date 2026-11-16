import {
  DowntimeExportQuery,
  DowntimeHistoryQuery,
  OperationalEventsExportQuery,
  OperationalEventsQuery,
  TelemetryExportQuery,
  TelemetryHistoryQuery,
  WorkOrdersQuery,
} from '../../types/historical';
import { TelemetryRollupQuery } from '../../types/analytics';

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

export function buildOperationalEventsEndpoint(query: OperationalEventsQuery): string {
  const isGlobal = !query.device_id || query.device_id === 'ALL';
  const base = isGlobal
    ? '/api/v1/operational-events/'
    : `/api/v1/operational-events/${encodeURIComponent(query.device_id!)}`;
  const qs = buildQueryString({
    machine_id: isGlobal ? query.machine_id : undefined,
    from: query.from,
    to: query.to,
    event_type: query.event_type,
    cursor: query.cursor,
    limit: query.limit,
    envelope: query.envelope ?? true,
  });
  return `${base}${qs}`;
}

export function buildOperationalEventsExportEndpoint(query: OperationalEventsExportQuery): string {
  const isGlobal = !query.device_id || query.device_id === 'ALL';
  const base = isGlobal
    ? '/api/v1/operational-events/export'
    : `/api/v1/operational-events/${encodeURIComponent(query.device_id!)}/export`;
  const qs = buildQueryString({
    machine_id: isGlobal ? query.machine_id : undefined,
    from: query.from,
    to: query.to,
    event_type: query.event_type,
    format: query.format,
    limit: query.limit,
  });
  return `${base}${qs}`;
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
  return `/api/v1/telemetry/${encodeURIComponent(query.device_id)}${qs}`;
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
  return `/api/v1/telemetry/rollup${qs}`;
}

export function buildTelemetryExportEndpoint(query: TelemetryExportQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    format: query.format,
    limit: query.limit,
  });
  return `/api/v1/telemetry/${encodeURIComponent(query.device_id)}/export${qs}`;
}

export function buildTelemetryHourlyExportEndpoint(query: TelemetryExportQuery): string {
  const qs = buildQueryString({
    from: query.from,
    to: query.to,
    format: query.format,
    limit: query.limit,
  });
  return `/api/v1/telemetry/${encodeURIComponent(query.device_id)}/hourly/export${qs}`;
}
