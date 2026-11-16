import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from '../services/api/client';
import { ReconciliationError } from '../types/historical';
import {
  RETENTION_POLICY_DAYS,
  buildDowntimeExportEndpoint,
  buildDowntimeHistoryEndpoint,
  buildOperationalEventsEndpoint,
  buildOperationalEventsExportEndpoint,
  buildTelemetryExportEndpoint,
  buildTelemetryHistoryEndpoint,
  buildTelemetryHourlyExportEndpoint,
  canExportHistoricalData,
  mapDowntimeToSixBigLoss,
  paginateWithCursor,
  parseExportMetadataHeaders,
  serializeExportRecords,
  validateRetentionWindow,
} from './historicalExport';

test('Retention policy: validateRetentionWindow rejects >90 days with RETENTION_EXCEEDED 400', () => {
  const now = new Date('2026-11-12T12:00:00Z');
  const within90d = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString();
  const beyond90d = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const ok = validateRetentionWindow(within90d, to, now, RETENTION_POLICY_DAYS);
  assert.equal(ok.valid, true);

  const exceeded = validateRetentionWindow(beyond90d, to, now, RETENTION_POLICY_DAYS);
  assert.equal(exceeded.valid, false);
  assert.equal(exceeded.code, 'RETENTION_EXCEEDED');
  assert.equal(exceeded.status, 400);
  assert.match(exceeded.message ?? '', /RETENTION_EXCEEDED/);

  const reversed = validateRetentionWindow(to, within90d, now, RETENTION_POLICY_DAYS);
  assert.equal(reversed.valid, false);
  assert.equal(reversed.code, 'INVALID_TIME_RANGE');
});

test('Export authorization grants ADMIN/SUPERVISOR and denies OPERATOR/MAINTENANCE with 403', () => {
  assert.equal(canExportHistoricalData('ADMIN').allowed, true);
  assert.equal(canExportHistoricalData('SUPERVISOR').allowed, true);

  const opRes = canExportHistoricalData('OPERATOR');
  assert.equal(opRes.allowed, false);
  assert.equal(opRes.status, 403);

  const maintRes = canExportHistoricalData('MAINTENANCE');
  assert.equal(maintRes.allowed, false);
  assert.equal(maintRes.status, 403);
});

test('paginateWithCursor orders descending and iterates opaque Base64URL cursors without overlap', () => {
  const items = Array.from({ length: 12 }, (_, idx) => ({
    id: `ev-${String(idx + 1).padStart(2, '0')}`,
    ts: new Date(Date.UTC(2026, 10, 1 + idx, 10, 0, 0)).toISOString(),
  }));

  const page1 = paginateWithCursor(items, (x) => x.ts, { limit: 5 });
  assert.equal(page1.data.length, 5);
  assert.equal(page1.data[0].id, 'ev-12');
  assert.equal(page1.data[4].id, 'ev-08');
  assert.equal(page1.pagination.has_more, true);
  assert.ok(page1.pagination.next_cursor);

  const page2 = paginateWithCursor(items, (x) => x.ts, {
    limit: 5,
    cursor: page1.pagination.next_cursor,
  });
  assert.equal(page2.data.length, 5);
  assert.equal(page2.data[0].id, 'ev-07');
  assert.equal(page2.data[4].id, 'ev-03');
  assert.equal(page2.pagination.has_more, true);

  const page3 = paginateWithCursor(items, (x) => x.ts, {
    limit: 5,
    cursor: page2.pagination.next_cursor,
  });
  assert.equal(page3.data.length, 2);
  assert.equal(page3.data[0].id, 'ev-02');
  assert.equal(page3.data[1].id, 'ev-01');
  assert.equal(page3.pagination.has_more, false);
  assert.equal(page3.pagination.next_cursor, null);
});

test('mapDowntimeToSixBigLoss maps canonical categories to Six Big Losses & OEE pillars', () => {
  assert.equal(mapDowntimeToSixBigLoss('EQUIPMENT_FAILURE').group, 'BREAKDOWNS');
  assert.equal(mapDowntimeToSixBigLoss('SETUP_AND_ADJUSTMENT').oee_pillar, 'AVAILABILITY');
  assert.equal(mapDowntimeToSixBigLoss('IDLING_AND_MINOR_STOPPAGE').group, 'SMALL_STOPS');
  assert.equal(mapDowntimeToSixBigLoss('REDUCED_SPEED').oee_pillar, 'PERFORMANCE');
  assert.equal(mapDowntimeToSixBigLoss('PROCESS_DEFECT').oee_pillar, 'QUALITY');
  assert.equal(mapDowntimeToSixBigLoss('PLANNED_MAINTENANCE').oee_pillar, 'PLANNED_EXCLUSION');
});

test('Endpoint builders match authoritative backend routes & parse X-Export-* metadata headers', () => {
  const dtHist = buildDowntimeHistoryEndpoint({
    device_id: 'STM32-OEE-01',
    unlabeled_only: true,
    limit: 10,
  });
  assert.match(dtHist, /^\/api\/v1\/downtime-events\/STM32-OEE-01\?/);
  assert.match(dtHist, /unlabeled_only=true/);

  const dtExp = buildDowntimeExportEndpoint({
    device_id: 'STM32-OEE-01',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-12T00:00:00Z',
    format: 'csv',
  });
  assert.match(dtExp, /^\/api\/v1\/downtime-events\/STM32-OEE-01\/export\?/);

  const opGlobal = buildOperationalEventsEndpoint({ device_id: 'ALL', machine_id: 'CNC-MILLING-01' });
  assert.match(opGlobal, /^\/api\/v1\/operational-events\?/);
  assert.match(opGlobal, /machine_id=CNC-MILLING-01/);

  const opPerDevice = buildOperationalEventsEndpoint({ device_id: 'STM32-OEE-02', event_type: 'ALARM' });
  assert.match(opPerDevice, /^\/api\/v1\/operational-events\/STM32-OEE-02\?/);

  const opGlobalExp = buildOperationalEventsExportEndpoint({
    device_id: 'ALL',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-12T00:00:00Z',
    format: 'csv',
  });
  assert.match(opGlobalExp, /^\/api\/v1\/operational-events\/export\?/);

  const opDevExp = buildOperationalEventsExportEndpoint({
    device_id: 'STM32-OEE-03',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-12T00:00:00Z',
    format: 'ndjson',
  });
  assert.match(opDevExp, /^\/api\/v1\/operational-events\/STM32-OEE-03\/export\?/);

  const telHist = buildTelemetryHistoryEndpoint({ device_id: 'STM32-OEE-01', limit: 10 });
  assert.match(telHist, /^\/api\/v1\/telemetry\/STM32-OEE-01\?/);

  const telExp = buildTelemetryExportEndpoint({
    device_id: 'STM32-OEE-01',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-12T00:00:00Z',
    format: 'json',
  });
  assert.match(telExp, /^\/api\/v1\/telemetry\/STM32-OEE-01\/export\?/);

  const telHourlyExp = buildTelemetryHourlyExportEndpoint({
    device_id: 'STM32-OEE-01',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-12T00:00:00Z',
    format: 'csv',
  });
  assert.match(telHourlyExp, /^\/api\/v1\/telemetry\/STM32-OEE-01\/hourly\/export\?/);

  const meta = parseExportMetadataHeaders({
    'X-Export-Source': 'timescaledb:downtime_events',
    'X-Export-Generated-At': '2026-11-12T10:00:00Z',
    'X-Export-Device-Id': 'STM32-OEE-03',
    'X-Export-Time-Window': '2026-11-01T00:00:00Z..2026-11-12T00:00:00Z',
  });
  assert.equal(meta.source, 'timescaledb:downtime_events');
  assert.equal(meta.deviceId, 'STM32-OEE-03');
});

test('serializeExportRecords escapes CSV commas/quotes and outputs valid NDJSON and JSON', () => {
  const sample = [
    { id: '1', note: 'Drop, "140 bar"', value: 42 },
    { id: '2', note: 'Normal', value: 10 },
  ];

  const csv = serializeExportRecords(sample, 'csv');
  assert.match(csv.content, /"Drop, ""140 bar"""/);

  const ndjson = serializeExportRecords(sample, 'ndjson');
  const lines = ndjson.content.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).id, '1');

  const json = serializeExportRecords(sample, 'json');
  assert.equal(JSON.parse(json.content).length, 2);
});

test('apiClient export contracts enforce 90-day retention, RBAC 403, and read-only tunnel compatibility', async () => {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const expiredFrom = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  // 1. OPERATOR is rejected with 403 Forbidden
  apiClient.setUserRole('OPERATOR');
  apiClient.setNetworkMode('LAN');
  await assert.rejects(
    async () => {
      await apiClient.exportDowntimeData({ device_id: 'STM32-OEE-01', from: validFrom, to, format: 'csv' });
    },
    (err: unknown) =>
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string; httpStatus?: number; status?: number }).code === 'FORBIDDEN' &&
      ((err as { httpStatus?: number; status?: number }).httpStatus === 403 ||
        (err as { httpStatus?: number; status?: number }).status === 403)
  );

  // 2. ADMIN over REMOTE_TUNNEL succeeds for read-only export & includes X-Export-* metadata
  apiClient.setUserRole('ADMIN');
  apiClient.setNetworkMode('REMOTE_TUNNEL');
  const dtExport = await apiClient.exportDowntimeData({
    device_id: 'STM32-OEE-01',
    from: validFrom,
    to,
    format: 'json',
  });
  assert.equal(dtExport.metadata.source, 'timescaledb:downtime_events');
  assert.equal(dtExport.metadata.deviceId, 'STM32-OEE-01');
  assert.ok(dtExport.rowCount > 0);
  const parsedDt = JSON.parse(dtExport.content);
  assert.ok(parsedDt[0].six_big_loss_group, 'Exported downtime rows must include Six Big Losses');

  // 3. >90 days rejected with RETENTION_EXCEEDED 400 on downtime, operational-events, telemetry, and telemetry hourly
  for (const runExport of [
    () => apiClient.exportDowntimeData({ device_id: 'STM32-OEE-01', from: expiredFrom, to, format: 'csv' }),
    () => apiClient.exportOperationalEventsData({ device_id: 'ALL', from: expiredFrom, to, format: 'ndjson' }),
    () =>
      apiClient.exportOperationalEventsData({ device_id: 'STM32-OEE-01', from: expiredFrom, to, format: 'csv' }),
    () => apiClient.exportTelemetryData({ device_id: 'STM32-OEE-01', from: expiredFrom, to, format: 'json' }),
    () =>
      apiClient.exportTelemetryHourlyData({ device_id: 'STM32-OEE-01', from: expiredFrom, to, format: 'csv' }),
  ]) {
    await assert.rejects(
      runExport,
      (err: unknown) =>
        err instanceof ReconciliationError && err.code === 'RETENTION_EXCEEDED' && err.status === 400
    );
  }

  // 4. Authz decision audit recorded export ALLOW/DENY decisions
  assert.ok(store.iamAuditDecisions.some((d) => d.action === 'refresh:telemetry' && d.decision === 'ALLOW'));
  assert.ok(
    store.iamAuditDecisions.some(
      (d) => (d.action === 'export.telemetry' || d.action === 'refresh:telemetry') && d.decision === 'DENY'
    )
  );

  // Restore defaults
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
});
