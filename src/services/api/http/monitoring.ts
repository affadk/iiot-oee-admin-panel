/**
 * Method HTTP — domain monitoring.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, reqExport, checkAbortHttp } from './transport';
import { mapLiveState, mapDowntime, mapOperationalEvent, mapAuditLog, mapTelemetryHistory, mapHourly, mapRollup, mapAggregate } from './mappers';
import { num, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { buildDowntimeExportEndpoint, buildDowntimeHistoryEndpoint, buildOperationalEventsEndpoint, buildOperationalEventsExportEndpoint, buildTelemetryExportEndpoint, buildTelemetryHistoryEndpoint, buildTelemetryHourlyExportEndpoint, buildTelemetryRollupEndpoint } from '../../../utils/historicalExport';
import { LiveStateRecord, DowntimeEvent, OperationalEvent, DowntimeCategory } from '../../../types/monitoring';
import { HourlyOeePoint, TelemetryAggregateResult, TelemetryHistoryRecord, TelemetryRangeOptions, TelemetryRollupItem, TelemetryRollupQuery } from '../../../types/analytics';
import { AuditLogItem } from '../../../types/system';
import { CursorPageResponse, DowntimeExportQuery, DowntimeHistoryQuery, ExportResult, OperationalEventsExportQuery, OperationalEventsQuery, TelemetryExportQuery, TelemetryHistoryQuery } from '../../../types/historical';

export const httpMonitoring = {
  // -- Live State ------------------------------------------------------------
  async getLiveState(signal?: AbortSignal): Promise<LiveStateRecord[]> {
    checkAbortHttp(signal);
    return reqList(
      { path: ADMIN_ENDPOINTS.LIVE_STATE.buildPath(), signal, endpointKey: 'LIVE_STATE' },
      mapLiveState,
      100,
    ).then((p) => p.data);
  },

  async getLiveStateByDevice(deviceId: string, signal?: AbortSignal): Promise<LiveStateRecord> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.LIVE_STATE_BY_DEVICE.buildPath(deviceId), signal, endpointKey: 'LIVE_STATE_BY_DEVICE', capability: 'telemetry.read', resourceId: deviceId },
      mapLiveState,
    );
  },

  // -- Downtime ---------------------------------------------------------------
  async getActiveDowntimes(signal?: AbortSignal): Promise<DowntimeEvent[]> {
    checkAbortHttp(signal);
    return reqList(
      { path: ADMIN_ENDPOINTS.DOWNTIME_ACTIVE.buildPath(), signal, endpointKey: 'DOWNTIME_ACTIVE' },
      mapDowntime,
      100,
    ).then((p) => p.data);
  },

  async getDowntimeHistory(deviceId: string, signal?: AbortSignal): Promise<DowntimeEvent[]> {
    const page = await httpMonitoring.getDowntimeHistoryPage({ device_id: deviceId, limit: 100 }, signal);
    return page.data;
  },

  async getDowntimeHistoryPage(
    query: DowntimeHistoryQuery,
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<DowntimeEvent>> {
    checkAbortHttp(signal);
    const endpoint = buildDowntimeHistoryEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'DOWNTIME_BY_DEVICE' }, mapDowntime, query.limit ?? 50);
  },

  async exportDowntimeData(query: DowntimeExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildDowntimeExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'DOWNTIME_DEVICE_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `downtime_${query.device_id}.csv`,
    );
  },

  async classifyDowntimeReason(
    id: string,
    category: DowntimeCategory,
    reason: string,
    notes?: string,
  ): Promise<DowntimeEvent> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.DOWNTIME_REASON.buildPath(id),
      body: { category, reason, ...(notes ? { notes } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'DOWNTIME_REASON',
      capability: 'downtime.reason.label',
      resourceId: id,
    });
    return mapDowntime({ ...raw, id: pick(raw.eventId, raw.event_id, id), category, operatorReason: reason });
  },

  // -- Operational Events & System Audit --------------------------------------
  async getOperationalEventsByDevice(
    deviceId: string,
    query: Omit<OperationalEventsQuery, 'device_id'> = {},
    signal?: AbortSignal,
  ): Promise<OperationalEvent[]> {
    const page = await httpMonitoring.getOperationalEventsPage({ ...query, device_id: deviceId }, signal);
    return page.data;
  },

  async getOperationalEvents(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal,
  ): Promise<OperationalEvent[]> {
    const page = await httpMonitoring.getOperationalEventsPage(query, signal);
    return page.data;
  },

  async getOperationalEventsPage(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<OperationalEvent>> {
    checkAbortHttp(signal);
    const endpoint = buildOperationalEventsEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'OPERATIONAL_EVENTS_LIST' }, mapOperationalEvent, query.limit ?? 50);
  },

  async exportOperationalEventsData(
    query: OperationalEventsExportQuery,
    signal?: AbortSignal,
  ): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildOperationalEventsExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'OPERATIONAL_EVENTS_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      'operational-events.csv',
    );
  },

  async acknowledgeOperationalEvent(id: string, note?: string): Promise<OperationalEvent> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'PATCH',
      path: ADMIN_ENDPOINTS.OPERATIONAL_EVENTS_ACK.buildPath(id),
      body: { ...(note ? { note } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATIONAL_EVENTS_ACK',
      capability: 'operational_event.ack',
      resourceId: id,
    });
    return mapOperationalEvent({
      ...raw,
      id: pick(raw.id, id),
      acknowledged: true,
      acknowledgedAt: pick(raw.acknowledgedAt, raw.acknowledged_at),
      acknowledgedBy: pick(raw.acknowledgedBy, raw.acknowledged_by),
      ackNote: pick(raw.ackNote, raw.ack_note, note),
    });
  },

  async getSystemAuditPage(
    query: { from?: string; to?: string; event_type?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<AuditLogItem>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SYSTEM_AUDIT.buildPath(),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(query.event_type ? { event_type: query.event_type } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'SYSTEM_AUDIT',
        capability: 'audit.system.read',
      },
      mapAuditLog,
      query.limit ?? 50,
    );
  },

  async getAuditLogs(signal?: AbortSignal): Promise<AuditLogItem[]> {
    const page = await httpMonitoring.getSystemAuditPage({ limit: 200 }, signal);
    return page.data;
  },

  // -- Telemetry ----------------------------------------------------------------
  // E12 T12.8 (F-9 / FAT-61): getTelemetryHistory (non-page, tanpa query)
  // DIHAPUS — hanya dipakai contract test, bukan UI; riwayat telemetry
  // dibaca lewat getTelemetryHistoryPage (from/to/limit/cursor).
  async getHourlyTrend(
    deviceId: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId),
        query: {
          ...(options?.from ? { from: options.from } : {}),
          ...(options?.to ? { to: options.to } : {}),
          ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        },
        signal,
        endpointKey: 'TELEMETRY_HOURLY',
        capability: 'telemetry.read',
        resourceId: deviceId,
      },
      mapHourly,
      // E12 T12.18 (U-4 / FAT-65): limit default dokumen 72 bucket
      // (Guide tabel endpoint + API doc §E "default 72 bucket terakhir").
      options?.limit ?? 72,
    ).then((p) => p.data);
  },

  async getTelemetryAggregate(
    deviceId: string,
    // E12 T12.18 (U-4 / FAT-65): bucket default dokumen `5m`
    // (Guide tabel endpoint §4.1).
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '5m',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<TelemetryAggregateResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const rows = await reqList(
      {
        path: ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId),
        query: {
          bucket,
          ...(options?.from ? { from: options.from } : {}),
          ...(options?.to ? { to: options.to } : {}),
          ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        },
        signal,
        endpointKey: 'TELEMETRY_AGGREGATE',
        capability: 'telemetry.read',
        resourceId: deviceId,
      },
      mapAggregate,
      options?.limit ?? 500,
    ).then((p) => p.data);
    // E12 T12.2 (F-5 / FAT-51): kembalikan SELURUH rows (bukan rows[0]).
    // Ringkasan dihitung dari deret: rata-rata komponen OEE per bucket,
    // total parts + sampel = jumlah seluruh bucket. Performance null
    // (kapasitas unknown) dikeluarkan dari rata-rata; bila semua null → 0.
    const mean1 = (vals: number[]): number =>
      vals.length === 0 ? 0 : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const performanceVals = rows
      .map((r) => r.performancePct)
      .filter((v): v is string | number => v !== null)
      .map((v) => num(v, 0));
    return {
      device_id: deviceId,
      bucket,
      avg_oee: mean1(rows.map((r) => num(r.oeePct, 0))),
      avg_availability: mean1(rows.map((r) => num(r.availabilityPct, 0))),
      avg_performance: mean1(performanceVals),
      avg_quality: mean1(rows.map((r) => num(r.qualityPct, 0))),
      total_parts: rows.reduce((a, r) => a + r.totalCount, 0),
      sample_count: rows.reduce((a, r) => a + r.sampleCount, 0),
      rows,
    };
  },

  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryRollupEndpoint(query);
    // E12 T12.18 (U-4 / FAT-65): limit default dokumen 500 (API doc §K.3c,
    // `limit` 1..2000 default 500) — dipakai bila pemanggil tidak mengirim
    // limit; halaman tetap mengirim ukuran paginasinya sendiri (50).
    return reqList({ path: endpoint, signal, endpointKey: 'TELEMETRY_ROLLUP' }, mapRollup, query.limit ?? 500);
  },

  async exportTelemetryData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `telemetry_${query.device_id}.csv`,
    );
  },

  async exportTelemetryHourlyData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryHourlyExportEndpoint(query);
    return reqExport(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_HOURLY_EXPORT', capability: 'export.telemetry', resourceId: query.device_id },
      query.format,
      `telemetry_hourly_${query.device_id}.csv`,
    );
  },

  async getTelemetryHistoryPage(
    query: TelemetryHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryHistoryRecord>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryHistoryEndpoint(query);
    return reqList(
      { path: endpoint, signal, endpointKey: 'TELEMETRY_HISTORY', capability: 'telemetry.read', resourceId: query.device_id },
      mapTelemetryHistory,
      query.limit ?? 50,
    );
  },

  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number; date?: string; shift?: string } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
    // E12 T12.1 (X-1 / FAT-54): `date`/`shift` diterima demi paritas
    // antarmuka dengan demo, tapi TIDAK dikirim — API doc §I tidak
    // mendefinisikan keduanya untuk /oee/hourly; jendela shift dibawa
    // oleh from/to. Demo memakainya hanya sebagai petunjuk proyeksi seed.
    return reqList(
      {
        path: ADMIN_ENDPOINTS.OEE_HOURLY.buildPath(),
        query: {
          ...(params.machine_id ? { machine_id: params.machine_id } : {}),
          ...(params.device_id ? { device_id: params.device_id } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
        signal,
        endpointKey: 'OEE_HOURLY',
      },
      mapHourly,
      // E12 T12.18 (U-4 / FAT-65): limit default dokumen 72 — sama dengan
      // getHourlyTrend di atas (Guide tabel endpoint + API doc §E).
      params.limit ?? 72,
    ).then((p) => p.data);
  }
};
