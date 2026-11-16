import { DowntimeEvent, OperationalEvent } from '../../types/monitoring';
import { TelemetryHistoryRecord } from '../../types/analytics';
import { ExportFormat, ExportMetadata } from '../../types/historical';
import { mapDowntimeToSixBigLoss } from './sixBigLoss';

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
