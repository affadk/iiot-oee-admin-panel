/**
 * Method demo — domain telemetry.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues, generateTelemetrySeries, REJECT_PARETO_BY_DEVICE } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Shift } from '../../../types/production';
import { ShiftSummary, HourlyOeePoint, ShiftTimelineSegment, RejectParetoItem, TelemetryHistoryRecord, TelemetryRollupItem, TelemetryRollupQuery, ReconciliationJob, ReconciliationRefreshRequest } from '../../../types/analytics';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse, ExportResult, TelemetryExportQuery, TelemetryHistoryQuery } from '../../../types/historical';
import { TelemetryRollupItemSchema } from '../schemas';
import { RETENTION_POLICY_DAYS, assertRetentionWindow, buildTelemetryExportEndpoint, buildTelemetryHistoryEndpoint, buildTelemetryHourlyExportEndpoint, buildTelemetryRollupEndpoint, formatTelemetryExportRows, paginateWithCursor, parseExportMetadataHeaders, serializeExportRecords } from '../../../utils/historicalExport';

export const demoTelemetry = {
  // =========================================================================
  // TELEMETRY, OEE, QUALITY & RECONCILIATION (12 ops)
  // =========================================================================
  async getShiftSummary(machineId?: string, signal?: AbortSignal): Promise<ShiftSummary> {
    checkAbort(signal);
    const qs = machineId ? `?machine_id=${encodeURIComponent(machineId)}` : '';
    store.recordEndpoint('OEE_SHIFT_SUMMARY', `${ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath()}${qs}`);
    const targetMachine = store.machines.find((m) => m.machine_id === machineId) || store.machines[0];
    const live = store.liveStates.find((l) => l.machine_id === targetMachine?.machine_id);
    return {
      shift_name: 'Shift 1 (07:00-15:00)',
      machine_id: targetMachine?.machine_id || 'CNC-MILLING-01',
      machine_name: targetMachine?.name || 'CNC Milling Center Alpha',
      shift_start: '2026-11-11T07:00:00+07:00',
      shift_end: '2026-11-11T15:00:00+07:00',
      tz: 'Asia/Jakarta',
      oee: live?.oee ?? 84.6,
      availability: live?.availability ?? 92.4,
      performance: live?.performance ?? 94.1,
      quality: live?.quality ?? 97.4,
      planned_production_time_min: 480,
      planned_break_min: 60,
      operating_time_min: 420,
      run_time_min: 388,
      unplanned_downtime_min: 32,
      planned_downtime_min: 60,
      total_parts: live?.total_count ?? 350,
      good_parts: live?.good_count ?? 342,
      defect_parts: live?.reject_count ?? 8,
      target_per_hour: 64,
    };
  },

  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
    signal?: AbortSignal
  ): Promise<ShiftTimelineSegment[]> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (machineId) qs.set('machine_id', machineId);
    store.recordEndpoint('OEE_SHIFT_TIMELINE', `${ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath()}?${qs.toString()}`);
    return [
      { start: '07:00', end: '09:15', fsm_state: 'RUNNING', planned: false, duration_min: 135 },
      { start: '09:15', end: '09:30', fsm_state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'dt-ev-02', duration_min: 15 },
      { start: '09:30', end: '12:00', fsm_state: 'RUNNING', planned: false, duration_min: 150 },
      { start: '12:00', end: '12:45', fsm_state: 'PLANNED_DOWNTIME', planned: true, downtime_id: 'dt-ev-04', duration_min: 45 },
      { start: '12:45', end: '14:49', fsm_state: 'RUNNING', planned: false, duration_min: 124 },
      { start: '14:49', end: '15:00', fsm_state: 'BATCH_FINISHED', planned: false, duration_min: 11 },
    ];
  },

  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (params.machine_id) qs.set('machine_id', params.machine_id);
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    const qStr = qs.toString();
    store.recordEndpoint('OEE_HOURLY', `${ADMIN_ENDPOINTS.OEE_HOURLY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const devId =
      params.device_id ||
      store.machines.find((m) => m.machine_id === params.machine_id)?.bound_device_id ||
      'STM32-OEE-01';
    return demoTelemetry.getHourlyTrend(devId, signal);
  },

  async getHourlyTrend(deviceId: string, signal?: AbortSignal): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    if (!deviceId) {
      throwValidationIssues('device_id wajib disediakan.', { device_id: 'Wajib dipilih.' });
    }
    store.recordEndpoint('TELEMETRY_HOURLY', ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId));
    const isUnknownCapacity = deviceId === 'STM32-OEE-05';
    return [
      { hour: '07:00', oee: isUnknownCapacity ? 0 : 78.4, availability: isUnknownCapacity ? 100 : 88.0, performance: isUnknownCapacity ? 0 : 91.0, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 42, good_count: isUnknownCapacity ? 0 : 41, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3168, hourly_downtime_sec: 432, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '08:00', oee: isUnknownCapacity ? 0 : 84.6, availability: isUnknownCapacity ? 100 : 92.4, performance: isUnknownCapacity ? 0 : 94.1, quality: isUnknownCapacity ? 100 : 97.4, parts_produced: isUnknownCapacity ? 0 : 48, good_count: isUnknownCapacity ? 0 : 47, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3326, hourly_downtime_sec: 274, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '09:00', oee: isUnknownCapacity ? 0 : 86.2, availability: isUnknownCapacity ? 100 : 94.0, performance: isUnknownCapacity ? 0 : 93.5, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 50, good_count: isUnknownCapacity ? 0 : 49, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3384, hourly_downtime_sec: 216, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '10:00', oee: isUnknownCapacity ? 0 : 82.0, availability: isUnknownCapacity ? 100 : 90.0, performance: isUnknownCapacity ? 0 : 92.0, quality: isUnknownCapacity ? 100 : 99.0, parts_produced: isUnknownCapacity ? 0 : 46, good_count: isUnknownCapacity ? 0 : 46, defect_count: 0, hourly_operating_sec: 3600, hourly_run_sec: 3240, hourly_downtime_sec: 360, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '11:00', oee: isUnknownCapacity ? 0 : 85.5, availability: isUnknownCapacity ? 100 : 93.0, performance: isUnknownCapacity ? 0 : 94.0, quality: isUnknownCapacity ? 100 : 97.8, parts_produced: isUnknownCapacity ? 0 : 49, good_count: isUnknownCapacity ? 0 : 48, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3348, hourly_downtime_sec: 252, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '12:00', oee: 0.0, availability: 0.0, performance: 0.0, quality: 100.0, parts_produced: 0, good_count: 0, defect_count: 0, hourly_operating_sec: 0, hourly_run_sec: 0, hourly_downtime_sec: 3600, sampleCount: 12, targetPerHour: 0, state: 'PLANNED_DOWNTIME', planned: true, provisional: false },
      { hour: '13:00', oee: isUnknownCapacity ? 0 : 87.8, availability: isUnknownCapacity ? 100 : 95.0, performance: isUnknownCapacity ? 0 : 94.5, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 52, good_count: isUnknownCapacity ? 0 : 51, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3420, hourly_downtime_sec: 180, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
      { hour: '14:00', oee: isUnknownCapacity ? 0 : 84.0, availability: isUnknownCapacity ? 100 : 92.0, performance: isUnknownCapacity ? 0 : 93.0, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 47, good_count: isUnknownCapacity ? 0 : 46, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3312, hourly_downtime_sec: 288, sampleCount: 44, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
    ];
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
    checkAbort(signal);
    store.recordEndpoint(
      'TELEMETRY_AGGREGATE',
      `${ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId)}?bucket=${bucket}`
    );
    const mult = bucket === '1m' ? 12 : bucket === '5m' ? 36 : bucket === '15m' ? 108 : bucket === '1h' ? 432 : 1850;
    return {
      device_id: deviceId,
      bucket,
      avg_oee: deviceId === 'STM32-OEE-05' ? 0 : 83.5,
      avg_availability: deviceId === 'STM32-OEE-05' ? 100 : 91.4,
      avg_performance: deviceId === 'STM32-OEE-05' ? 0 : 93.1,
      avg_quality: deviceId === 'STM32-OEE-05' ? 100 : 98.0,
      total_parts: deviceId === 'STM32-OEE-05' ? 0 : Math.round(mult * 0.77),
      sample_count: mult,
    };
  },

  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbort(signal);
    const fromMs = Date.parse(query.from);
    const toMs = Date.parse(query.to);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
      throwValidationIssues('Rentang waktu rollup from/to tidak valid.', {
        from: 'Pastikan format ISO 8601 valid dan from <= to.',
      });
    }

    const endpoint = buildTelemetryRollupEndpoint(query);
    store.recordEndpoint('TELEMETRY_ROLLUP', endpoint);

    const rows: TelemetryRollupItem[] = [];

    if (query.group_by === 'machine') {
      const candidates = [
        ...store.machines.map((m) => ({
          machine_id: m.machine_id as string | null,
          machine_name: m.name as string | null,
          device_id: m.bound_device_id,
          zeroCapacity: false,
        })),
        ...store.devices
          .filter((d) => !d.bound_machine_id)
          .map((d) => ({
            machine_id: null as string | null,
            machine_name: 'Unbound Edge Controller' as string | null,
            device_id: d.device_id as string | null,
            zeroCapacity: true,
          })),
      ];

      candidates.forEach((cand, idx) => {
        if (query.machine_id && query.machine_id !== 'ALL' && cand.machine_id !== query.machine_id) return;
        if (query.device_id && query.device_id !== 'ALL' && cand.device_id !== query.device_id) return;
        const live = store.liveStates.find(
          (l) =>
            (cand.device_id && l.device_id === cand.device_id) ||
            (cand.machine_id && l.machine_id === cand.machine_id)
        );
        const operatingSec = cand.zeroCapacity ? 14400 : 28800 - idx * 1200;
        const avail = cand.zeroCapacity ? 100 : live?.availability ?? 90.2;
        const runSec = Math.round((operatingSec * avail) / 100);
        const totalCount = cand.zeroCapacity ? 0 : Math.max(120, (live?.total_count ?? 220) * 4);
        const rejectCount = cand.zeroCapacity ? 0 : Math.max(2, (live?.reject_count ?? 5) * 3);
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const perf = cand.zeroCapacity ? null : Number((live?.performance ?? 92.5).toFixed(2));
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: cand.machine_id ?? cand.device_id ?? `row-${idx}`,
            groupBy: 'machine',
            machineId: cand.machine_id ?? null,
            machine_id: cand.machine_id,
            machine_name: cand.machine_name,
            device_id: cand.device_id,
            bucket: new Date(toMs).toISOString().slice(0, 10),
            totalCount,
            goodCount,
            rejectCount,
            operatingSec,
            runSec,
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: cand.zeroCapacity ? 48 : 380 - idx * 35,
            provisional: true,
          })
        );
      });
    } else if (query.group_by === 'day') {
      const days = 7;
      for (let i = 0; i < days; i++) {
        const dayDate = new Date(toMs - i * 24 * 3600_000);
        if (dayDate.getTime() < fromMs - 24 * 3600_000) continue;
        const dayKey = dayDate.toISOString().slice(0, 10);
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((91.8 - (i % 4) * 1.3).toFixed(2));
        const perf = zeroCap ? null : Number((93.6 - (i % 3) * 1.1).toFixed(2));
        const totalCount = zeroCap ? 0 : 940 - i * 24;
        const rejectCount = zeroCap ? 0 : 18 + (i % 5) * 3;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: dayKey,
            groupBy: 'day',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Aggregated',
            device_id: query.device_id ?? null,
            bucket: dayKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 57600,
            runSec: Math.round((57600 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 1440 - i * 40,
            provisional: i === 0,
          })
        );
      }
    } else {
      // month
      for (let i = 0; i < 4; i++) {
        const d = new Date(toMs);
        d.setUTCMonth(d.getUTCMonth() - i);
        const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((90.5 - i * 0.9).toFixed(2));
        const perf = zeroCap ? null : Number((92.4 - i * 0.7).toFixed(2));
        const totalCount = zeroCap ? 0 : 24200 - i * 1150;
        const rejectCount = zeroCap ? 0 : 480 - i * 20;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: monthKey,
            groupBy: 'month',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Monthly Rollup',
            device_id: query.device_id ?? null,
            bucket: monthKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 1_555_200,
            runSec: Math.round((1_555_200 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 41200 - i * 1800,
            provisional: i === 0,
          })
        );
      }
    }

    return paginateWithCursor(
      rows,
      (item) => (item.bucket && /^\d{4}-\d{2}/.test(item.bucket) ? `${item.bucket}T00:00:00Z` : new Date(toMs).toISOString()),
      {
        cursor: query.cursor,
        limit: query.limit ?? 50,
        maxLimit: 100,
        getId: (item) => item.groupKey,
      }
    );
  },

  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    store.recordEndpoint('QUALITY_REJECTS_GLOBAL', ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath());
    const map = new Map<string, number>();
    Object.values(REJECT_PARETO_BY_DEVICE)
      .flat()
      .forEach((item) => {
        map.set(item.reason, (map.get(item.reason) ?? 0) + item.count);
      });
    const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => {
        const percentage = Number(((count / total) * 100).toFixed(1));
        cumulative = Math.min(100, Number((cumulative + percentage).toFixed(1)));
        return { reason, count, percentage, cumulative_percentage: cumulative };
      });
  },

  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    if (!deviceId) {
      return demoTelemetry.getRejectParetoGlobal(signal);
    }
    store.recordEndpoint('QUALITY_REJECTS_BY_DEVICE', ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId));
    return [...(REJECT_PARETO_BY_DEVICE[deviceId] ?? [])];
  },

  async getTelemetryHistory(deviceId: string, signal?: AbortSignal): Promise<TelemetryHistoryRecord[]> {
    checkAbort(signal);
    const devId = deviceId || 'STM32-OEE-01';
    store.recordEndpoint('TELEMETRY_HISTORY', ADMIN_ENDPOINTS.TELEMETRY_HISTORY.buildPath(devId));
    return generateTelemetrySeries(devId, 20);
  },

  async getTelemetryHistoryPage(
    query: TelemetryHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryHistoryRecord>> {
    checkAbort(signal);
    const endpoint = buildTelemetryHistoryEndpoint(query);
    store.recordEndpoint('TELEMETRY_HISTORY', endpoint);

    let items = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60);
    if (query.is_buffered !== undefined) {
      items = items.filter((r) => Boolean(r.is_buffered) === query.is_buffered);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((r) => new Date(r.timestamp).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((r) => new Date(r.timestamp).getTime() <= toMs);
    }

    return paginateWithCursor(items, (r) => r.timestamp, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async exportTelemetryData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryExportEndpoint(query);
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_EXPORT');
    store.recordEndpoint('TELEMETRY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60)
      .filter((r) => {
        const ts = new Date(r.timestamp).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rows = formatTelemetryExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:oee_telemetry_logs',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async exportTelemetryHourlyData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryHourlyExportEndpoint(query);
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_HOURLY_EXPORT');
    store.recordEndpoint('TELEMETRY_HOURLY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);
    const hourly = await demoTelemetry.getHourlyTrend(query.device_id, signal);
    const rows = hourly.map((h) => ({ ...h }));
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:telemetry_hourly_cagg',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_hourly_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async getReconciliationJobs(signal?: AbortSignal): Promise<ReconciliationJob[]> {
    checkAbort(signal);
    store.recordEndpoint('RECONCILIATION_JOBS', ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath());
    return [
      {
        job_id: 'job-cagg-hourly',
        name: 'Ringkasan OEE Shift Per Jam',
        view_name: 'telemetry_hourly_cagg',
        schedule_interval: 'Every 15 minutes',
        last_run: '2026-11-11T08:30:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 24,
        records_processed: 1420,
      },
      {
        job_id: 'job-cagg-daily',
        name: 'Ringkasan Produksi Harian Pabrik',
        view_name: 'production_daily_summary',
        schedule_interval: 'Every 1 hour',
        last_run: '2026-11-11T08:00:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 168,
        records_processed: 8940,
      },
    ];
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string }> {
    assertCapability('telemetry.reconciliation.refresh', ['ADMIN', 'SUPERVISOR']);
    const fromVal = request.from ?? request.startWindow;
    const toVal = request.to ?? request.endWindow;
    if (fromVal && toVal) {
      const fromMs = Date.parse(fromVal);
      const toMs = Date.parse(toVal);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
        throwValidationIssues('Rentang rekonsiliasi from/to tidak valid.', {
          from: 'Pastikan format ISO 8601 valid dan from <= to.',
        });
      }
    }

    const now = Date.now();
    store.reconciliationCallTimestamps = store.reconciliationCallTimestamps.filter((t) => now - t < 60_000);
    if (store.reconciliationCallTimestamps.length >= 10) {
      throw new ApiError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Batas pembaruan tercapai (maksimal 10 kali per menit). Silakan tunggu sebentar sebelum mencoba lagi.',
        httpStatus: 429,
      });
    }
    store.reconciliationCallTimestamps.push(now);

    store.recordEndpoint('RECONCILIATION_REFRESH', ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath());
    const rangeDesc = `${fromVal ?? '24 jam terakhir'} .. ${toVal ?? 'sekarang'}`;
    store.addAudit(
      'RECONCILIATION_REFRESH',
      'SYSTEM',
      'telemetry_hourly_cagg',
      `Memperbarui ringkasan data per jam (${rangeDesc})`
    );
    return {
      success: true,
      message: `Pembaruan ringkasan data selesai untuk rentang ${rangeDesc}.`,
    };
  }
};
