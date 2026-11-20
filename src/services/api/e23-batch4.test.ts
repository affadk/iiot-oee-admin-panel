import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { httpApiClient } from './httpClient';
import { demoApiClient } from './client';
import { ADMIN_ENDPOINTS } from './endpoints';
import { resolveAccessMode, resolveApiMode } from './mode';
import { mapIamInfo, mapMqttDynsecStatus } from './http/mappers/system';
import { validateDeviceInput } from '../../utils/capabilities';
import { LoginPage } from '../../features/auth/LoginPage';
import { AuthProvider } from '../../context/AuthContext';
import { NetworkAccessProvider } from '../../context/NetworkAccessContext';

// ---------------------------------------------------------------------------
// E23 Batch 4 (FAT-203–FAT-208, N-33 + N-35–N-39 Low panel): perbaikan
// frontend terhadap spec live `~/workspace/oee-live-openapi.json`
// (141 operasi). Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk
// api_docs lama); setiap test meng-assert mapper/transport/UI berperilaku
// benar terhadap bentuk itu.
//
// Port 3050–3057: 3001–3049 sudah dipakai stub lain (undici keep-alive
// rusak bila port dipakai ulang); VITE_API_URL di-set dan di-restore di
// try/finally.
// ---------------------------------------------------------------------------

const LOGIN_BODY = {
  success: true,
  token: 'stub-token',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; url: string; body: unknown };

function startStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown } | null,
) {
  const seen: SeenReq[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, url: url.pathname + url.search, body });
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(LOGIN_BODY));
        return;
      }
      const out = handler(req, url, body);
      if (out) {
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out.payload));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` }));
    });
  });
  return { server, seen };
}

async function withStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown } | null,
  run: (seen: SeenReq[]) => Promise<void>,
) {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://localhost:${port}/api/v1`;
  const { server, seen } = startStub(port, handler);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  try {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    await run(seen);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
  }
}

// ---------------------------------------------------------------------------
// N-33 (FAT-203): DynSec status — bentuk spec live.
// ---------------------------------------------------------------------------

const DYNSEC_SPEC = {
  connected: true,
  subscribed: true,
  connecting: false,
  pluginReady: true,
  brokerUrl: 'mqtt://mosquitto:1883',
  adminUsername: 'dynsec-admin',
  lastError: null,
  lastConnectedAt: '2026-11-19T09:00:00.000Z',
};

test('E23 N-33 (FAT-203): DynSec status spec live dipetakan utuh (connected/subscribed/pluginReady/brokerUrl/…) ', async () => {
  await withStub(3050, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/dynamic-security/status') {
      return { status: 200, payload: DYNSEC_SPEC };
    }
    return null;
  }, async () => {
    const st = await httpApiClient.getMqttDynamicSecurityStatus();
    assert.equal(st.connected, true);
    assert.equal(st.subscribed, true);
    assert.equal(st.connecting, false);
    assert.equal(st.pluginReady, true);
    assert.equal(st.brokerUrl, 'mqtt://mosquitto:1883');
    assert.equal(st.adminUsername, 'dynsec-admin');
    assert.equal(st.lastError, null);
    assert.equal(st.lastConnectedAt, '2026-11-19T09:00:00.000Z');
    // Bentuk lama sudah tidak ada — tidak ada lagi status DISCONNECTED palsu.
    assert.ok(!('status' in st) && !('enabled' in st) && !('clients_count' in st));
  });
});

test('E23 N-33 (FAT-203): payload bentuk LAMA tidak lagi menghasilkan DISCONNECTED palsu', () => {
  const st = mapMqttDynsecStatus({
    enabled: true,
    status: 'CONNECTED',
    clients_count: 3,
    roles_count: 2,
    groups_count: 1,
  });
  assert.equal(st.connected, false);
  assert.equal(st.subscribed, false);
  assert.equal(st.pluginReady, false);
  assert.equal(st.brokerUrl, '');
  assert.equal(st.lastError, null);
  assert.equal(st.lastConnectedAt, null);
  assert.ok(!('status' in st) && !('enabled' in st));
});

test('E23 N-33 (FAT-203): demo DynSec status memakai bentuk spec live', async () => {
  demoApiClient.setNetworkMode('LAN');
  demoApiClient.setUserRole('ADMIN');
  demoApiClient.setSessionActive(true);
  try {
    const st = await demoApiClient.getMqttDynamicSecurityStatus();
    assert.equal(st.connected, true);
    assert.equal(st.pluginReady, true);
    assert.equal(st.brokerUrl, 'mqtt://localhost:1883');
    assert.equal(st.lastError, null);
    assert.ok(typeof st.lastConnectedAt === 'string' && st.lastConnectedAt.length > 0);
  } finally {
    demoApiClient.setSessionActive(false, null);
  }
});

// ---------------------------------------------------------------------------
// N-35 (FAT-204): WO cancel/resolve — tanpa fabrikasi.
// ---------------------------------------------------------------------------

const RESOLVE_BASE = {
  success: true,
  work_order: {
    wo_id: 'WO-100',
    machine_id: 'CNC-MILLING-01',
    product_id: 'PRD-01',
    product_name: 'Bracket',
    std_cycle_time_sec: 45,
    operator_id: 'OP-001',
    operator_name: 'Operator Satu',
    target_qty: 350,
    shift_plan: { shift_start: '07:00', shift_end: '15:00', planned_break_min: 60, planned_operating_sec: 25200 },
    status: 'ACTIVE',
  },
};

test('E23 N-35 (FAT-204): resolve tanpa break + targetPerHour null → null (bukan break kosong / 0)', async () => {
  await withStub(3052, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders/WO-100/resolve') {
      return { status: 200, payload: { ...RESOLVE_BASE, work_order: { ...RESOLVE_BASE.work_order, targetPerHour: null } } };
    }
    return null;
  }, async () => {
    const res = await httpApiClient.resolveWorkOrder('WO-100', 'STM32-OEE-01');
    assert.equal(res.work_order.break, null);
    assert.equal(res.work_order.targetPerHour, null);
    assert.equal(res.work_order.status, 'ACTIVE');
  });
});

test('E23 N-35 (FAT-204): resolve dengan break + targetPerHour tetap dibaca apa adanya', async () => {
  await withStub(3053, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders/WO-100/resolve') {
      return {
        status: 200,
        payload: {
          ...RESOLVE_BASE,
          work_order: {
            ...RESOLVE_BASE.work_order,
            targetPerHour: 50,
            break: { start: '12:00', end: '13:00', minutes: 60 },
          },
        },
      };
    }
    return null;
  }, async () => {
    const res = await httpApiClient.resolveWorkOrder('WO-100', 'STM32-OEE-01');
    assert.deepEqual(res.work_order.break, { start: '12:00', end: '13:00', minutes: 60 });
    assert.equal(res.work_order.targetPerHour, 50);
  });
});

test('E23 N-35 (FAT-204): cancel membaca status dari respons (bukan hardcode)', async () => {
  await withStub(3054, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders/WO-100/cancel') {
      return { status: 200, payload: { success: true, work_order: { wo_id: 'WO-100', status: 'PENDING', machine_id: 'CNC-MILLING-01' } } };
    }
    return null;
  }, async () => {
    // Stub sintetis: status 'PENDING' di respons harus mengalir ke hasil —
    // membuktikan nilai dibaca, bukan di-hardcode 'ABORTED'.
    const res = await httpApiClient.cancelWorkOrder('WO-100', 'dibatalkan');
    assert.equal(res.work_order.status, 'PENDING');
    assert.equal(res.work_order.machine_id, 'CNC-MILLING-01');
  });
});

test('E23 N-35 (FAT-204): cancel tanpa status di respons tetap ABORTED (fallback)', async () => {
  await withStub(3055, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders/WO-100/cancel') {
      return { status: 200, payload: { success: true, work_order: { wo_id: 'WO-100', machine_id: null } } };
    }
    return null;
  }, async () => {
    const res = await httpApiClient.cancelWorkOrder('WO-100');
    assert.equal(res.work_order.status, 'ABORTED');
    assert.equal(res.work_order.machine_id, null);
  });
});

// ---------------------------------------------------------------------------
// N-36 (FAT-205): IAM info — catalogueVersion + enforcedDomains wajib.
// ---------------------------------------------------------------------------

test('E23 N-36 (FAT-205): IAM info spec live — catalogueVersion + enforcedDomains dipertahankan', async () => {
  await withStub(3056, (_req, url) => {
    if (url.pathname === '/api/v1/access-control/info') {
      return {
        status: 200,
        payload: {
          mode: 'enforce',
          effectiveInMode: 'enforce',
          enforcedDomains: ['work_orders', 'operators'],
          catalogueVersion: '2026.11.19',
          authzVersion: 7,
        },
      };
    }
    return null;
  }, async () => {
    const info = await httpApiClient.getIamInfo();
    assert.equal(info.catalogueVersion, '2026.11.19');
    assert.deepEqual(info.enforcedDomains, ['work_orders', 'operators']);
    assert.equal(info.mode, 'enforce');
    assert.equal(info.authzVersion, 7);
  });
});

test('E23 N-36 (FAT-205): IAM info tanpa enforcedDomains → [] (toleransi, bukan undefined)', () => {
  const info = mapIamInfo({ mode: 'shadow', effectiveInMode: 'shadow', catalogueVersion: '1.0.0', authzVersion: 3 });
  assert.deepEqual(info.enforcedDomains, []);
  assert.equal(info.catalogueVersion, '1.0.0');
});

// ---------------------------------------------------------------------------
// N-37 (FAT-206): legacy POST /devices — tanpa model/serial, MAC opsional.
// ---------------------------------------------------------------------------

test('E23 N-37 (FAT-206): register tanpa MAC tidak mengirim macAddress; body tanpa model/serial_number', async () => {
  await withStub(3057, (_req, url, body) => {
    if (url.pathname === '/api/v1/devices') {
      const b = body as Record<string, unknown>;
      return {
        status: 201,
        payload: {
          deviceId: b.deviceId, model: null, macAddress: null,
          ipAddress: (b.ipAddress as string | undefined) ?? null, firmwareVersion: null,
          online: false, last_seen: null, bound_machine_id: null, bound_machine_name: null,
          enrollmentState: 'ACTIVE', provisionedAt: null, credentialRotatedAt: null,
          created_at: '2026-11-19T10:00:00.000Z',
        },
      };
    }
    return null;
  }, async (seen) => {
    const created = await httpApiClient.registerDevice({ device_id: 'STM32-OEE-06' });
    assert.equal(created.device_id, 'STM32-OEE-06');
    const sent = seen.find((s) => s.path === '/api/v1/devices')?.body as Record<string, unknown>;
    assert.equal(sent.deviceId, 'STM32-OEE-06');
    assert.ok(!('macAddress' in sent), 'macAddress tidak dikirim bila kosong');
    assert.ok(!('model' in sent) && !('serial_number' in sent) && !('serialNumber' in sent));
  });
});

test('E23 N-37 (FAT-206): register dengan MAC tetap mengirim macAddress', async () => {
  await withStub(3058, (_req, url, body) => {
    if (url.pathname === '/api/v1/devices') {
      const b = body as Record<string, unknown>;
      return {
        status: 201,
        payload: {
          deviceId: b.deviceId, model: null, macAddress: b.macAddress,
          ipAddress: null, firmwareVersion: null,
          online: false, last_seen: null, bound_machine_id: null, bound_machine_name: null,
          enrollmentState: 'ACTIVE', provisionedAt: null, credentialRotatedAt: null,
          created_at: '2026-11-19T10:00:00.000Z',
        },
      };
    }
    return null;
  }, async (seen) => {
    const created = await httpApiClient.registerDevice({ device_id: 'STM32-OEE-07', mac_address: '00:08:DC:55:01:0A' });
    assert.equal(created.mac_address, '00:08:DC:55:01:0A');
    const sent = seen.find((s) => s.path === '/api/v1/devices')?.body as Record<string, unknown>;
    assert.equal(sent.macAddress, '00:08:DC:55:01:0A');
  });
});

test('E23 N-37 (FAT-206): validator — MAC kosong saat create bukan error; MAC berformat salah tetap error', () => {
  const noMac = validateDeviceInput({ deviceId: 'STM32-OEE-06', isCreate: true });
  assert.equal(noMac.macAddress, undefined);
  const badMac = validateDeviceInput({ deviceId: 'STM32-OEE-06', macAddress: 'invalid-mac', isCreate: true });
  assert.ok(badMac.macAddress);
  const okMac = validateDeviceInput({ deviceId: 'STM32-OEE-06', macAddress: '00:08:DC:55:01:0A', isCreate: true });
  assert.deepEqual(okMac, {});
});

test('E23 N-37 (FAT-206): demo register tanpa MAC berhasil dan tidak mengisi model/serial', async () => {
  demoApiClient.setNetworkMode('LAN');
  demoApiClient.setUserRole('ADMIN');
  demoApiClient.setSessionActive(true);
  try {
    const created = await demoApiClient.registerDevice({ device_id: 'STM32-B4-01' });
    assert.equal(created.device_id, 'STM32-B4-01');
    assert.equal(created.mac_address, '');
    assert.equal(created.model, undefined);
    assert.equal(created.serial_number, undefined);
    await demoApiClient.deleteDevice('STM32-B4-01');
  } finally {
    demoApiClient.setSessionActive(false, null);
  }
});

// ---------------------------------------------------------------------------
// N-38 (FAT-207): badge mode API + label mode akses di halaman Login.
// ---------------------------------------------------------------------------

test('E23 N-38 (FAT-207): LoginPage menampilkan badge mode API + label mode akses (teks sama seperti Topbar)', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        NetworkAccessProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(LoginPage)),
      ),
    ),
  );
  const apiMode = resolveApiMode();
  const accessMode = resolveAccessMode();
  assert.ok(html.includes(`aria-label="API Mode: ${apiMode}"`), 'badge API punya aria-label mode');
  assert.ok(html.includes(apiMode === 'real' ? '>Real<' : '>Demo<'), 'badge API menampilkan teks mode');
  assert.ok(html.includes(`aria-label="Mode Akses: ${accessMode}"`), 'label akses punya aria-label mode');
  assert.ok(html.includes(accessMode === 'public' ? '>Public<' : '>Private<'), 'label akses menampilkan teks mode');
  // Tidak ada gate login baru: tombol submit tetap ada.
  assert.ok(html.includes('Masuk ke Admin Panel'));
});

// ---------------------------------------------------------------------------
// N-39 (FAT-208): MQTT_CONFIG_GET tanpa trailing slash + komentar header.
// ---------------------------------------------------------------------------

test('E23 N-39 (FAT-208): registry MQTT_CONFIG_GET = /api/v1/mqtt/configuration (tanpa slash akhir)', () => {
  assert.equal(ADMIN_ENDPOINTS.MQTT_CONFIG_GET.template, '/api/v1/mqtt/configuration');
  assert.equal(ADMIN_ENDPOINTS.MQTT_CONFIG_GET.buildPath(), '/api/v1/mqtt/configuration');
});

test('E23 N-39 (FAT-208): getBrokerConfig memanggil path tanpa trailing slash', async () => {
  await withStub(3059, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration') {
      return { status: 200, payload: { version: '1', general: {}, limits: {}, listeners: [], bridges: [], unmanaged: [] } };
    }
    return null;
  }, async (seen) => {
    const cfg = await httpApiClient.getBrokerConfig();
    assert.equal(cfg.version, '1');
    const hit = seen.find((s) => s.path.startsWith('/api/v1/mqtt/configuration'));
    assert.ok(hit, 'GET /api/v1/mqtt/configuration terpanggil');
    assert.equal(hit?.path, '/api/v1/mqtt/configuration');
    assert.ok(!seen.some((s) => s.path === '/api/v1/mqtt/configuration/'), 'tidak ada lagi path berslash akhir');
  });
});
