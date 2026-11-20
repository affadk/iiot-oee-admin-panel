import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';


test('E20 P20.4: health/detail + hapus sintesis; op-events FR-034-01 + export system-audit (stub, port 3007)', async () => {
  // Port 3007: 3001–3006 sudah dipakai stub lain — undici keep-alive rusak
  // bila port dipakai ulang; VITE_API_URL di-set/restore di try/finally.
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = 'http://localhost:3007/api/v1';
  const seen: Array<{ method: string | undefined; path: string; search: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3007');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, search: url.search, body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        json(200, {
          success: true,
          token: 'stub-jwt',
          expires_in: 900,
          operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/health') {
        // Bentuk lean (API doc §A) — tanpa label/environment/latency.
        json(200, {
          status: 'ok',
          uptime: 3600.42,
          timestamp: '2026-11-19T03:00:00.000Z',
          ws_clients: 2,
          db_connected: true,
          buffer_pending: 0,
          buffer_dropped: 0,
          metrics: null,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/health/detail') {
        json(200, {
          measuredAt: '2026-11-19T03:00:00.000Z',
          application: {
            status: 'UP',
            name: 'iiot-oee-backend',
            version: '1.0.0',
            environment: 'production',
            commit: null,
            uptimeSeconds: 3600.42,
            measuredAt: '2026-11-19T03:00:00.000Z',
          },
          database: { status: 'UP', latencyMs: 1.87, measuredAt: '2026-11-19T03:00:00.000Z' },
          mqtt: {
            status: 'UP',
            adminConnection: {
              connected: true,
              pluginReady: true,
              lastError: null,
              lastConnectedAt: '2026-11-19T02:00:00.000Z',
            },
            clientsCount: 12,
            measuredAt: '2026-11-19T03:00:00.010Z',
          },
          websocket: { status: 'UP', clients: 3, measuredAt: '2026-11-19T03:00:00.010Z' },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/operational-events') {
        json(200, {
          data: [
            {
              id: 42,
              recordedAt: '2026-11-19T02:10:00.000Z',
              deviceId: 'STM32-OEE-01',
              machineId: 'M-01',
              machineName: 'Press Line 1',
              woId: 'WO-2026-001',
              eventType: 'MASTER_DATA_MUTATION',
              triggerSource: 'ADMIN_PANEL',
              eventCode: 0,
              snapshotTotalCount: null,
              snapshotRunSec: null,
              description: 'Machine renamed',
              acknowledged: false,
              acknowledgedAt: null,
              acknowledgedBy: null,
              ackNote: null,
              createdAt: '2026-11-19T02:10:01.000Z',
            },
            {
              id: 43,
              recordedAt: '2026-11-19T01:00:00.000Z',
              deviceId: 'STM32-OEE-01',
              machineId: null,
              machineName: null,
              woId: null,
              eventType: 'DEVICE_OFFLINE',
              triggerSource: 'DEVICE',
              eventCode: null,
              snapshotTotalCount: null,
              snapshotRunSec: null,
              description: 'Device offline',
              acknowledged: false,
              acknowledgedAt: '2026-11-19T01:05:00.000Z',
              acknowledgedBy: 'ADM-001',
              ackNote: 'Checked',
              createdAt: '2026-11-19T01:00:01.000Z',
            },
          ],
          meta: { limit: 50, hasMore: false, nextCursor: null, count: 2 },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/system/audit') {
        json(200, {
          data: [
            {
              id: 44,
              recordedAt: '2026-11-19T02:10:00.000Z',
              deviceId: 'STM32-OEE-01',
              machineId: 'CNC-MILLING-01',
              machineName: 'CNC Milling Center Alpha',
              woId: null,
              eventType: 'WORK_ORDER_CANCELLED',
              triggerSource: 'ADMIN_PANEL',
              eventCode: null,
              snapshotTotalCount: null,
              snapshotRunSec: null,
              description: 'Cancelled WO',
              acknowledged: true,
              acknowledgedAt: '2026-11-19T02:11:00.000Z',
              acknowledgedBy: 'ADM-001',
              ackNote: null,
              createdAt: '2026-11-19T02:10:01.000Z',
            },
          ],
          meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/system/audit/export') {
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="system_audit_2026-11-19.csv"',
          'X-Export-Source': 'system_audit',
          'X-Export-Generated-At': '2026-11-19T03:00:00.000Z',
          'X-Export-Time-Window': '2026-11-01T00:00:00Z..2026-11-12T00:00:00Z',
        });
        res.end('id,recorded_at,event_type\n44,2026-11-19T02:10:00.000Z,WORK_ORDER_CANCELLED\n');
        return;
      }
      if (req.method === 'PATCH' && url.pathname === '/api/v1/operational-events/42/ack') {
        json(200, {
          id: 42,
          acknowledgedAt: '2026-11-19T03:05:00.000Z',
          acknowledgedBy: 'ADM-001',
          ackNote: 'Noted',
          acknowledged: true,
        });
        return;
      }
      json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${req.method} ${url.pathname}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(3007, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');

    // /health lean: tidak ada sintesis — label/environment/latency null,
    // mqtt UNKNOWN + connected_clients null (bukan fallback wsClients).
    const health = await httpApiClient.getSystemHealth();
    assert.equal(health.backend.label, null);
    assert.equal(health.backend.environment, null);
    assert.equal(health.backend.latency_ms, null);
    assert.equal(health.backend.status, 'UNKNOWN');
    assert.equal(health.mqtt.status, 'UNKNOWN');
    assert.equal(health.mqtt.connected_clients, null);
    assert.equal(health.mqtt.dynamic_security, null);
    assert.equal(health.metrics, null);

    // /health/detail: per-komponen + measuredAt; null dipertahankan (commit).
    const detail = await httpApiClient.getHealthDetail();
    assert.equal(detail.application.status, 'UP');
    assert.equal(detail.application.name, 'iiot-oee-backend');
    assert.equal(detail.application.version, '1.0.0');
    assert.equal(detail.application.environment, 'production');
    assert.equal(detail.application.commit, null);
    assert.equal(detail.application.uptimeSeconds, 3600.42);
    assert.equal(detail.application.measuredAt, '2026-11-19T03:00:00.000Z');
    assert.equal(detail.database.status, 'UP');
    assert.equal(detail.database.latencyMs, 1.87);
    assert.equal(detail.mqtt.adminConnection?.connected, true);
    assert.equal(detail.mqtt.adminConnection?.pluginReady, true);
    assert.equal(detail.mqtt.adminConnection?.lastError, null);
    assert.equal(detail.mqtt.clientsCount, 12);
    assert.equal(detail.websocket.clients, 3);

    // Op-events: mapper FR-034-01 — description/recordedAt dibaca,
    // acknowledged DITURUNKAN dari acknowledgedAt (baris 43: field
    // `acknowledged: false` diabaikan karena acknowledgedAt terisi),
    // machineName null bila mesin dihapus, meta.count = baris halaman.
    const page = await httpApiClient.getOperationalEventsPage({ acknowledged: true });
    assert.equal(page.data.length, 2);
    assert.equal(page.pagination.total_count, 2);
    assert.equal(page.data[0].description, 'Machine renamed');
    assert.equal(page.data[0].recorded_at, '2026-11-19T02:10:00.000Z');
    assert.equal(page.data[0].machine_name, 'Press Line 1');
    assert.equal(page.data[0].acknowledged, false);
    assert.equal(page.data[1].machine_name, null);
    assert.equal(page.data[1].acknowledged, true);
    assert.equal(page.data[1].acknowledged_by, 'ADM-001');

    const find = (method: string, path: string) =>
      seen.find((s) => s.method === method && s.path === path);
    // Filter acknowledged dikirim; machine_id TIDAK ke endpoint global.
    const opCall = find('GET', '/api/v1/operational-events');
    assert.ok(opCall?.search.includes('acknowledged=true'));
    assert.equal(opCall?.search.includes('machine_id'), false);

    // /system/audit: machine_id dikirim; tanpa field karangan.
    const auditPage = await httpApiClient.getSystemAuditPage({
      machine_id: 'CNC-MILLING-01',
      event_type: 'WORK_ORDER_CANCELLED',
    });
    assert.equal(auditPage.data.length, 1);
    assert.equal(auditPage.data[0].event_type, 'WORK_ORDER_CANCELLED');
    assert.equal(auditPage.data[0].acknowledged, true);
    assert.equal('operator_id' in auditPage.data[0], false);
    assert.equal('client_ip' in auditPage.data[0], false);
    assert.equal('access_mode' in auditPage.data[0], false);
    const auditCall = find('GET', '/api/v1/system/audit');
    assert.ok(auditCall?.search.includes('machine_id=CNC-MILLING-01'));
    assert.ok(auditCall?.search.includes('event_type=WORK_ORDER_CANCELLED'));

    // Export system-audit: format + filter + header X-Export-*.
    const exported = await httpApiClient.exportSystemAuditData({
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-12T00:00:00Z',
      machine_id: 'CNC-MILLING-01',
      format: 'csv',
    });
    assert.equal(exported.filename, 'system_audit_2026-11-19.csv');
    assert.equal(exported.format, 'csv');
    assert.equal(exported.rowCount, 1);
    assert.equal(exported.metadata.source, 'system_audit');
    const exportCall = find('GET', '/api/v1/system/audit/export');
    assert.ok(exportCall?.search.includes('machine_id=CNC-MILLING-01'));
    assert.ok(exportCall?.search.includes('format=csv'));

    // Ack: acknowledged diturunkan dari acknowledgedAt respons.
    const acked = await httpApiClient.acknowledgeOperationalEvent('42', 'Noted');
    assert.equal(acked.acknowledged, true);
    assert.equal(acked.acknowledged_at, '2026-11-19T03:05:00.000Z');
    assert.equal(acked.ack_note, 'Noted');
    assert.deepEqual(find('PATCH', '/api/v1/operational-events/42/ack')?.body, { note: 'Noted' });
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
