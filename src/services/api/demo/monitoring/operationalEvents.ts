/**
 * Method demo — domain monitoring: operational events: daftar, ekspor, acknowledge.
 *
 * Dipisah dari demo/monitoring.ts (445 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya
 * (../monitoring.ts).
 */
import { store } from '../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { OperationalEvent } from '../../../../types/monitoring';
import { ApiError } from '../../../../types/auth';
import { CursorPageResponse, OperationalEventsExportQuery, OperationalEventsQuery, ExportResult } from '../../../../types/historical';
import { RETENTION_POLICY_DAYS, assertRetentionWindow, buildOperationalEventsEndpoint, buildOperationalEventsExportEndpoint, formatOperationalEventExportRows, paginateWithCursor, parseExportMetadataHeaders, serializeExportRecords } from '../../../../utils/historicalExport';

export const demoMonitoringOperationalEvents = {
  async getOperationalEventsByDevice(
    deviceId: string,
    query: Omit<OperationalEventsQuery, 'device_id'> = {},
    signal?: AbortSignal
  ): Promise<OperationalEvent[]> {
    checkAbort(signal);
    const endpoint = buildOperationalEventsEndpoint({ ...query, device_id: deviceId });
    store.recordEndpoint('OPERATIONAL_EVENTS_BY_DEVICE', endpoint);
    return store.operationalEvents.filter((e) => e.device_id === deviceId).map((e) => ({ ...e }));
  },

  async getOperationalEvents(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal
  ): Promise<OperationalEvent[]> {
    const page = await demoMonitoringOperationalEvents.getOperationalEventsPage({ ...query, limit: 200 }, signal);
    return page.data;
  },

  async getOperationalEventsPage(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<OperationalEvent>> {
    checkAbort(signal);
    const isGlobal = !query.device_id || query.device_id === 'ALL';
    const endpoint = buildOperationalEventsEndpoint(query);
    store.recordEndpoint(
      isGlobal ? 'OPERATIONAL_EVENTS_LIST' : 'OPERATIONAL_EVENTS_BY_DEVICE',
      endpoint
    );

    let items = [...store.operationalEvents];
    if (!isGlobal) {
      items = items.filter((e) => e.device_id === query.device_id);
    }
    // E20 P20.4 (FAT-156, D-12): filter lokal demo hanya untuk parameter
    // terdaftar `GET /operational-events` — tanpa `machine_id` (hanya
    // /system/audit) dan tanpa `severity` (tidak didukung).
    if (query.event_type && query.event_type !== 'ALL') {
      items = items.filter((e) => e.event_type === query.event_type);
    }
    if (query.acknowledged !== undefined) {
      items = items.filter((e) => e.acknowledged === query.acknowledged);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((e) => new Date(e.recorded_at).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((e) => new Date(e.recorded_at).getTime() <= toMs);
    }

    return paginateWithCursor(items, (e) => e.recorded_at, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async exportOperationalEventsData(
    query: OperationalEventsExportQuery,
    signal?: AbortSignal
  ): Promise<ExportResult> {
    checkAbort(signal);
    const isGlobal = !query.device_id || query.device_id === 'ALL';
    const endpoint = buildOperationalEventsExportEndpoint(query);
    assertCapability('telemetry.refresh', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit(
      isGlobal ? 'OPERATIONAL_EVENTS_EXPORT' : 'OPERATIONAL_EVENTS_DEVICE_EXPORT'
    );
    store.recordEndpoint(
      isGlobal ? 'OPERATIONAL_EVENTS_EXPORT' : 'OPERATIONAL_EVENTS_DEVICE_EXPORT',
      endpoint
    );

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = store.operationalEvents
      .filter((e) => {
        if (!isGlobal && e.device_id !== query.device_id) return false;
        // E23 Batch 3 (FAT-201, N-34): filter event_type sisi klien
        // (paritas builder HTTP yang kini mengirimkannya ke server).
        if (query.event_type && e.event_type !== query.event_type) return false;
        const ts = new Date(e.recorded_at).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

    const rows = formatOperationalEventExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const deviceLabel = isGlobal ? 'ALL' : query.device_id!;
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': isGlobal
        ? 'timescaledb:operational_events_global'
        : 'timescaledb:operational_events_device',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': deviceLabel,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `operational_events_${isGlobal ? 'global' : deviceLabel}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async acknowledgeOperationalEvent(id: string, note?: string): Promise<OperationalEvent> {
    assertCapability('operational_event.ack', ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'], {
      resourceId: id,
    });
    if (note && note.length > 1000) {
      throwValidationIssues('Catatan ack maksimal 1000 karakter.', { note: 'Maksimal 1000 karakter.' });
    }

    store.recordEndpoint('OPERATIONAL_EVENTS_ACK', ADMIN_ENDPOINTS.OPERATIONAL_EVENTS_ACK.buildPath(id));
    const ev = store.operationalEvents.find((e) => e.id === id);
    if (!ev) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Operational event tidak ditemukan.', httpStatus: 404 });
    }

    // Idempotent acknowledgment (preserves original timestamp if already acknowledged unless note updated)
    if (!ev.acknowledged) {
      ev.acknowledged = true;
      ev.acknowledged_by = store.currentUserName;
      ev.acknowledged_at = new Date().toISOString();
    }
    if (note?.trim()) {
      ev.ack_note = note.trim();
    }
    store.addAudit(
      'ACK_EVENT',
      'DEVICE',
      ev.device_id ?? id,
      `Acknowledged event ${id}${ev.ack_note ? ` — Note: ${ev.ack_note}` : ''}`,
      { device_id: ev.device_id, machine_id: ev.machine_id, machine_name: ev.machine_name }
    );
    return { ...ev };
  }
};
