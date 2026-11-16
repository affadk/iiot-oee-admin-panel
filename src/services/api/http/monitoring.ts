/**
 * Method HTTP — domain monitoring.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, reqExport, checkAbortHttp } from './transport';
import { mapLiveState, mapDowntime, mapOperationalEvent, mapAuditLog, mapTelemetryHistory, mapHourly, mapRollup } from './mappers';
import { num, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { buildDowntimeExportEndpoint, buildDowntimeHistoryEndpoint, buildOperationalEventsEndpoint, buildOperationalEventsExportEndpoint, buildTelemetryExportEndpoint, buildTelemetryHistoryEndpoint, buildTelemetryHourlyExportEndpoint, buildTelemetryRollupEndpoint } from '../../../utils/historicalExport';
import { LiveStateRecord, DowntimeEvent, OperationalEvent, DowntimeCategory } from '../../../types/monitoring';
import { HourlyOeePoint, TelemetryHistoryRecord, TelemetryRollupItem, TelemetryRollupQuery } from '../../../types/analytics';
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
  async getTelemetryHistory(deviceId: string, signal?: AbortSignal): Promise<TelemetryHistoryRecord[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.TELEMETRY_HISTORY.buildPath(deviceId), signal, endpointKey: 'TELEMETRY_HISTORY', capability: 'telemetry.read', resourceId: deviceId },
      mapTelemetryHistory,
      100,
    ).then((p) => p.data);
  },

  async getHourlyTrend(deviceId: string, signal?: AbortSignal): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId), signal, endpointKey: 'TELEMETRY_HOURLY', capability: 'telemetry.read', resourceId: deviceId },
      mapHourly,
      100,
    ).then((p) => p.data);
  },

  async getTelemetryAggregate(
    deviceId: string,
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    signal?: AbortSignal
  ): Promise<{
    device_id: string;
    bucket: string;
    avg_oee: number;
    avg_availability: number;
    avg_performance: number;
    avg_quality: number;
    total_parts: number;
    sample_count: number;
  }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const rows = await reqList(
      {
        path: ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId),
        query: { bucket },
        signal,
        endpointKey: 'TELEMETRY_AGGREGATE',
        capability: 'telemetry.read',
        resourceId: deviceId,
      },
      (raw) => raw as Record<string, unknown>,
      100,
    ).then((p) => p.data);
    const first = rows[0] ?? {};
    return {
      device_id: deviceId,
      bucket,
      avg_oee: num(pick(first.avg_oee, first.avgOee, first.oeePct, first.oee), 0),
      avg_availability: num(pick(first.avg_availability, first.avgAvailability, first.availabilityPct, first.availability), 0),
      avg_performance: num(pick(first.avg_performance, first.avgPerformance, first.performancePct, first.performance), 0),
      avg_quality: num(pick(first.avg_quality, first.avgQuality, first.qualityPct, first.quality), 0),
      total_parts: num(pick(first.total_parts, first.totalParts, first.total_count, first.totalCount), 0),
      sample_count: num(pick(first.sample_count, first.sampleCount), 0),
    };
  },

  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const endpoint = buildTelemetryRollupEndpoint(query);
    return reqList({ path: endpoint, signal, endpointKey: 'TELEMETRY_ROLLUP' }, mapRollup, query.limit ?? 50);
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
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbortHttp(signal);
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
      params.limit ?? 100,
    ).then((p) => p.data);
  }
};
