import { UserRole } from '../types/auth';
import { DowntimeCategory, DowntimeEvent, OperationalEvent } from '../types/monitoring';
import { TelemetryHistoryRecord } from '../types/analytics';
import { TelemetryRollupQuery } from '../types/analytics';
import {
  CursorPageResponse,
  DowntimeExportQuery,
  DowntimeHistoryQuery,
  DowntimeSixBigLossMap,
  ExportFormat,
  ExportMetadata,
  OperationalEventsExportQuery,
  OperationalEventsQuery,
  ReconciliationError,
  SixBigLossInfo,
  TelemetryExportQuery,
  TelemetryHistoryQuery,
  TimeWindowPreset,
  WorkOrdersQuery,
} from '../types/historical';

export const RETENTION_POLICY_DAYS = 90;
export const DEFAULT_HISTORY_PAGE_LIMIT = 50;
export const EXPORT_TIMEOUT_MS = 90_000;

/**
 * Formats a Date into ISO 8601 with explicit timezone offset (e.g. `2026-11-01T00:00:00+07:00`).
 */
export function formatIsoWithOffset(date: Date = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = pad(Math.floor(absMin / 60));
  const mm = pad(absMin % 60);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hh}:${mm}`;
}

export async function withExportAbortTimeout<T>(
  outerSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = EXPORT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Export timeout exceeded', 'TimeoutError'));
  }, timeoutMs);

  const onOuterAbort = () => controller.abort(outerSignal?.reason);
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timer);
      controller.abort(outerSignal.reason);
    } else {
      outerSignal.addEventListener('abort', onOuterAbort, { once: true });
    }
  }

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    if (outerSignal) {
      outerSignal.removeEventListener('abort', onOuterAbort);
    }
  }
}

const SIX_BIG_LOSSES_MAP: DowntimeSixBigLossMap = {
  EQUIPMENT_FAILURE: {
    group: 'BREAKDOWNS',
    label: '1. Equipment Failures / Breakdowns',
    oee_pillar: 'AVAILABILITY',
  },
  SETUP_AND_ADJUSTMENT: {
    group: 'SETUP_AND_ADJUSTMENTS',
    label: '2. Setup & Adjustments',
    oee_pillar: 'AVAILABILITY',
  },
  IDLING_AND_MINOR_STOPPAGE: {
    group: 'SMALL_STOPS',
    label: '3. Idling & Minor Stops',
    oee_pillar: 'PERFORMANCE',
  },
  REDUCED_SPEED: {
    group: 'REDUCED_SPEED',
    label: '4. Reduced Speed',
    oee_pillar: 'PERFORMANCE',
  },
  PROCESS_DEFECT: {
    group: 'PROCESS_DEFECTS',
    label: '5. Process Defects & Rework',
    oee_pillar: 'QUALITY',
  },
  MATERIAL_SHORTAGE: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Startup / Material & Operational Losses',
    oee_pillar: 'AVAILABILITY',
  },
  PLANNED_MAINTENANCE: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Planned Maintenance Stop',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  REST_BREAK: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Scheduled Rest Break',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  CLEANING_5S: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Scheduled Cleaning / 5S',
    oee_pillar: 'PLANNED_EXCLUSION',
  },
  OTHER: {
    group: 'STARTUP_AND_PLANNED_LOSSES',
    label: '6. Startup / Other Losses',
    oee_pillar: 'AVAILABILITY',
  },
};

export function mapDowntimeToSixBigLoss(category: DowntimeCategory): SixBigLossInfo {
  return SIX_BIG_LOSSES_MAP[category] ?? SIX_BIG_LOSSES_MAP.OTHER;
}

/**
 * Validates time window against 90-day retention policy.
 */
export function validateRetentionWindow(
  fromIso: string,
  toIso: string,
  now: Date = new Date(),
  retentionDays: number = RETENTION_POLICY_DAYS
): {
  valid: boolean;
  code?: 'RETENTION_EXCEEDED' | 'INVALID_TIME_RANGE';
  status?: number;
  message?: string;
  daysFromNow: number;
} {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return {
      valid: false,
      code: 'INVALID_TIME_RANGE',
      status: 400,
      message: 'Parameter rentang waktu from/to tidak valid (gunakan format ISO-8601).',
      daysFromNow: 0,
    };
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      valid: false,
      code: 'INVALID_TIME_RANGE',
      status: 400,
      message: 'Waktu awal (from) tidak boleh lebih besar daripada waktu akhir (to).',
      daysFromNow: 0,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const retentionCutoffMs = now.getTime() - retentionDays * msPerDay;
  const daysFromNow = Math.max(0, Math.ceil((now.getTime() - fromDate.getTime()) / msPerDay));

  if (fromDate.getTime() < retentionCutoffMs) {
    return {
      valid: false,
      code: 'RETENTION_EXCEEDED',
      status: 400,
      message: `RETENTION_EXCEEDED: Permintaan ekspor data mentah (${daysFromNow} hari lalu) melampaui batas kebijakan retensi ${retentionDays} hari. Gunakan Continuous Aggregate (Shift Analytics) untuk laporan OEE jangka panjang.`,
      daysFromNow,
    };
  }

  return { valid: true, daysFromNow };
}

export function assertRetentionWindow(
  fromIso: string,
  toIso: string,
  now: Date = new Date(),
  retentionDays: number = RETENTION_POLICY_DAYS
): void {
  const result = validateRetentionWindow(fromIso, toIso, now, retentionDays);
  if (!result.valid && result.code) {
    throw new ReconciliationError(
      result.code,
      result.message || 'Retention policy exceeded',
      result.status || 400,
      retentionDays
    );
  }
}

export function canExportHistoricalData(role: UserRole): {
  allowed: boolean;
  status?: number;
  reason?: string;
} {
  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    reason:
      'Anda tidak memiliki izin untuk mengekspor data historis (khusus Admin dan Supervisor).',
  };
}

export function assertExportAuthorized(role: UserRole): void {
  const check = canExportHistoricalData(role);
  if (!check.allowed) {
    throw new ReconciliationError(
      'FORBIDDEN',
      check.reason || 'Anda tidak memiliki izin untuk mengekspor data historis.',
      check.status || 403
    );
  }
}

export function resolveTimeWindowPreset(
  preset: TimeWindowPreset,
  now: Date = new Date()
): { from: string; to: string } {
  const to = formatIsoWithOffset(now);
  const msPerHour = 60 * 60 * 1000;
  const msPerDay = 24 * msPerHour;

  switch (preset) {
    case '24h':
      return { from: formatIsoWithOffset(new Date(now.getTime() - msPerDay)), to };
    case '7d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
    case '30d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 30 * msPerDay)), to };
    case '90d':
      return {
        from: formatIsoWithOffset(
          new Date(now.getTime() - (RETENTION_POLICY_DAYS * msPerDay - msPerHour))
        ),
        to,
      };
    case 'custom':
    default:
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
  }
}

function encodeOpaqueCursor(ts: string, id: string): string {
  const json = JSON.stringify({ t: ts, id });
  if (typeof btoa === 'function') {
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeOpaqueCursor(cursor: string): { t: string; id: string } | null {
  try {
    let raw: string;
    if (typeof atob === 'function') {
      const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
      raw = atob(padded);
    } else {
      raw = Buffer.from(cursor, 'base64url').toString('utf8');
    }
    const parsed = JSON.parse(raw) as { t?: string; id?: string };
    if (parsed.t && parsed.id) return { t: parsed.t, id: parsed.id };
    return null;
  } catch {
    return null;
  }
}

/**
 * Server-side cursor pagination simulation in descending timestamp order (`ts DESC, id DESC`).
 * Cursors are opaque Base64URL tokens on the wire (Build Guide §4.7).
 */
export function paginateWithCursor<T>(
  items: T[],
  getTimestamp: (item: T) => string,
  options: { cursor?: string | null; limit?: number; maxLimit?: number; getId?: (item: T) => string } = {}
): CursorPageResponse<T> {
  const maxLimit = options.maxLimit ?? 100;
  const limit = Math.max(1, Math.min(maxLimit, options.limit ?? DEFAULT_HISTORY_PAGE_LIMIT));
  const getId =
    options.getId ??
    ((item: T) => {
      const rec = item as Record<string, unknown>;
      return String(rec.id ?? rec.wo_id ?? rec.machine_id ?? rec.product_id ?? '');
    });

  const sorted = [...items].sort((a, b) => {
    const diff = new Date(getTimestamp(b)).getTime() - new Date(getTimestamp(a)).getTime();
    if (diff !== 0) return diff;
    return getId(b).localeCompare(getId(a));
  });

  let startIndex = 0;
  if (options.cursor) {
    const decoded = decodeOpaqueCursor(options.cursor);
    if (decoded) {
      const idx = sorted.findIndex(
        (item) => getTimestamp(item) === decoded.t && getId(item) === decoded.id
      );
      if (idx >= 0) {
        startIndex = idx + 1;
      } else {
        const afterIdx = sorted.findIndex(
          (item) => new Date(getTimestamp(item)).getTime() < new Date(decoded.t).getTime()
        );
        startIndex = afterIdx >= 0 ? afterIdx : sorted.length;
      }
    }
  }

  const pageItems = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < sorted.length;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem ? encodeOpaqueCursor(getTimestamp(lastItem), getId(lastItem)) : null;

  return {
    data: pageItems,
    pagination: {
      limit,
      next_cursor: nextCursor,
      has_more: hasMore,
      truncated: hasMore,
      total_count: sorted.length,
    },
  };
}

export function parseExportMetadataHeaders(
  headers: Headers | Record<string, string | undefined>
): ExportMetadata {
  const read = (key: string): string => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(key) || (headers as Headers).get(key.toLowerCase()) || '';
    }
    const rec = headers as Record<string, string | undefined>;
    return rec[key] ?? rec[key.toLowerCase()] ?? '';
  };

  return {
    source: read('X-Export-Source') || 'timescaledb-hypertable',
    generatedAt: read('X-Export-Generated-At') || new Date().toISOString(),
    deviceId: read('X-Export-Device-Id') || 'ALL',
    timeWindow: read('X-Export-Time-Window') || '',
    contentDisposition: read('Content-Disposition') || undefined,
  };
}

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
    ? '/api/v1/operational-events'
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

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeExportRecords<T extends Record<string, unknown>>(
  records: T[],
  format: ExportFormat,
  columns?: (keyof T)[]
): { content: string; mimeType: string; extension: string } {
  if (format === 'json') {
    return {
      content: JSON.stringify(records, null, 2),
      mimeType: 'application/json;charset=utf-8',
      extension: 'json',
    };
  }

  if (format === 'ndjson') {
    return {
      content: records.map((r) => JSON.stringify(r)).join('\n'),
      mimeType: 'application/x-ndjson;charset=utf-8',
      extension: 'ndjson',
    };
  }

  const cols: (keyof T)[] =
    columns && columns.length > 0
      ? columns
      : records.length > 0
      ? (Object.keys(records[0]) as (keyof T)[])
      : [];

  const headerLine = cols.map((c) => escapeCsvCell(String(c))).join(',');
  const rows = records.map((row) => cols.map((c) => escapeCsvCell(row[c])).join(','));

  return {
    content: [headerLine, ...rows].join('\n'),
    mimeType: 'text/csv;charset=utf-8',
    extension: 'csv',
  };
}

export function formatDowntimeExportRows(events: DowntimeEvent[]): Record<string, unknown>[] {
  return events.map((ev) => {
    const sbl = mapDowntimeToSixBigLoss(ev.category);
    return {
      id: ev.id,
      device_id: ev.device_id ?? '[deleted]',
      machine_id: ev.machine_id ?? '[deleted]',
      machine_name: ev.machine_name,
      category: ev.category,
      six_big_loss_group: sbl.group,
      six_big_loss_label: sbl.label,
      oee_pillar: sbl.oee_pillar,
      reason: ev.reason,
      notes: ev.notes ?? '',
      is_labeled: ev.is_labeled,
      started_at: ev.started_at,
      ended_at: ev.ended_at ?? '',
      duration_seconds: ev.duration_seconds,
      duration_formatted: ev.durationFormatted ?? '',
      acknowledged_by: ev.acknowledged_by ?? '',
      created_at: ev.created_at,
    };
  });
}

export function formatOperationalEventExportRows(events: OperationalEvent[]): Record<string, unknown>[] {
  return events.map((ev) => ({
    id: ev.id,
    device_id: ev.device_id ?? '[deleted]',
    machine_name: ev.machine_name,
    event_type: ev.event_type,
    severity: ev.severity,
    message: ev.message,
    acknowledged: ev.acknowledged,
    acknowledged_by: ev.acknowledged_by ?? '',
    acknowledged_at: ev.acknowledged_at ?? '',
    ack_note: ev.ack_note ?? '',
    timestamp: ev.timestamp,
  }));
}

export function formatTelemetryExportRows(records: TelemetryHistoryRecord[]): Record<string, unknown>[] {
  return records.map((t) => ({
    id: t.id,
    device_id: t.device_id,
    timestamp: t.timestamp,
    fsm_state: t.fsm_state,
    total_count: t.total_count,
    good_count: t.good_count,
    reject_count: t.reject_count,
    oee: t.oee,
    availability: t.availability,
    performance: t.performance,
    quality: t.quality,
    cycle_time_ms: t.cycle_time_ms,
    temperature_c: t.temperature_c ?? '',
    vibration_rms: t.vibration_rms ?? '',
    is_buffered: t.is_buffered ?? false,
  }));
}

export function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
