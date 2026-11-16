import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient } from './client';
import { httpApiClient } from './httpClient';
import {
  resolveApiMode,
  resolveApiBaseUrl,
  resolveOriginBaseUrl,
  resolveEnvApiMode,
  isApiModeSwitchAllowed,
  isDemoPresetLoginEnabled,
  isNetworkModeSimulationAllowed,
  resolveMutationTimeoutMs,
  resolveHttpRetryMaxAttempts,
  resolveTunnelPort,
  resolveNetworkMode,
  resolveLoginMaxAttempts,
  resolveLoginCooldownSec,
  resolvePlantLabel,
  resolveDefaultStationId,
  resolveWsHeartbeatMs,
  resolveAuthTtlFallbackSec,
} from './mode';
import { ADMIN_ENDPOINTS, FORBIDDEN_ENDPOINT_PATTERNS } from './endpoints';
import {
  isRetryableHttpStatus,
  mapHttpErrorToApiError,
  normalizeListResponse,
  ProductionLineSchema,
} from './schemas';
import { buildOperationalEventsEndpoint } from '../../utils/historicalExport';
import { ApiError } from '../../types/auth';

test('Mode Demo vs Real (Guide §4.1): default demo, base URL fallback localhost:3001', () => {
  delete process.env.VITE_API_MODE;
  delete process.env.VITE_API_URL;
  assert.equal(resolveApiMode(), 'demo');
  assert.equal(resolveApiBaseUrl(), 'http://localhost:3001/api/v1');
  assert.equal(resolveOriginBaseUrl(), 'http://localhost:3001');
});

test('HTTP contract §4.2: retry hanya jaringan/502/503/504; 4xx tidak pernah retry', () => {
  for (const s of [0, 502, 503, 504]) assert.equal(isRetryableHttpStatus(s), true, `status ${s}`);
  for (const s of [200, 400, 401, 403, 404, 409, 422, 429]) assert.equal(isRetryableHttpStatus(s), false, `status ${s}`);
});

test('HTTP contract §4.3/§4.5: pemetaan error envelope {error, message, issues?, active_wo_id?}', () => {
  const notFound = mapHttpErrorToApiError(404, { error: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.' });
  assert.equal(notFound.code, 'MACHINE_NOT_FOUND');
  assert.equal(notFound.httpStatus, 404);
  assert.equal(notFound.message, 'Mesin tidak ditemukan.');

  const conflict = mapHttpErrorToApiError(409, {
    error: 'PRODUCT_ALREADY_EXISTS',
    message: 'Sudah ada.',
    issues: [{ field: 'product_id', code: 'duplicate', message: 'Duplikat.' }],
  });
  assert.equal(conflict.code, 'PRODUCT_ALREADY_EXISTS');
  assert.equal(conflict.issues?.[0]?.field, 'product_id');

  const unauth = mapHttpErrorToApiError(401, { error: 'UNAUTHORIZED', message: 'Sesi berakhir.' });
  assert.equal(unauth.code, 'UNAUTHORIZED');
  assert.equal(unauth.httpStatus, 401);

  const network = mapHttpErrorToApiError(0);
  assert.equal(network.code, 'NETWORK');
  assert.equal(network.httpStatus, 0);
});

test('HTTP contract D7: normalisasi list array ATAU envelope {data, meta}', () => {
  const fromArray = normalizeListResponse(
    [{ lineId: 'LINE-01', lineName: 'Lini 1', description: null, isActive: true, createdAt: '2026-01-02T07:00:00.000Z' }],
    ProductionLineSchema,
    50
  );
  assert.equal(fromArray.data.length, 1);
  assert.equal(fromArray.data[0].lineId, 'LINE-01');

  const fromEnvelope = normalizeListResponse(
    {
      data: [{ lineId: 'LINE-02', lineName: 'Lini 2', description: null, isActive: true, createdAt: '2026-01-02T07:05:00.000Z' }],
      meta: { total_count: 1, has_more: false, next_cursor: null },
    },
    ProductionLineSchema,
    50
  );
  assert.equal(fromEnvelope.data.length, 1);
  assert.equal(fromEnvelope.pagination.total_count, 1);
  assert.equal(fromEnvelope.pagination.has_more, false);
});

test('Guide §6.7: GET /operational-events/ WAJIB trailing slash; registry 131 ops admin', () => {
  assert.equal(ADMIN_ENDPOINTS.OPERATIONAL_EVENTS_LIST.buildPath(), '/api/v1/operational-events/');
  assert.ok(buildOperationalEventsEndpoint({}).startsWith('/api/v1/operational-events/'));
  assert.equal(Object.keys(ADMIN_ENDPOINTS).length, 131);
  for (const p of ['/command', '/dispatch', '/complete', '/work-orders/validate-zone', '/work-orders/initiate-from-zones']) {
    assert.ok((FORBIDDEN_ENDPOINT_PATTERNS as readonly string[]).includes(p), `forbidden: ${p}`);
  }
  // Actuation HMI tidak ada di permukaan apiClient (ADR-003)
  const client = apiClient as unknown as Record<string, unknown>;
  assert.equal(client.sendDeviceCommand, undefined);
  assert.equal(client.dispatchWorkOrder, undefined);
  assert.equal(client.completeWorkOrder, undefined);
});

test('Demo login (diperbaiki): mengembalikan operator sesuai LoginResponseSchema', async () => {
  const res = await apiClient.login('ADM-001', 'Admin@2026!');
  assert.equal(res.success, true);
  assert.equal(typeof res.token, 'string');
  assert.ok(res.token.length > 0);
  assert.equal(res.operator.id, 'ADM-001');
  assert.equal(res.operator.username, 'Alexandria Vance');
  assert.equal(res.operator.role, 'ADMIN');

  const refreshed = await apiClient.refreshSession();
  assert.equal(typeof refreshed.token, 'string');
  assert.equal(refreshed.expires_in, 900);
});

test('Demo CRUD Production Lines + RESTRICT saat dipakai (Guide §7.4)', async () => {
  const created = await apiClient.createProductionLine({
    lineId: 'LINE-T1',
    lineName: 'Lini Test',
    description: 'Lini sementara untuk test',
  });
  assert.equal(created.lineId, 'LINE-T1');
  assert.equal(created.isActive, true);

  const fetched = await apiClient.getProductionLineById('LINE-T1');
  assert.equal(fetched.lineName, 'Lini Test');

  const updated = await apiClient.updateProductionLine('LINE-T1', { lineName: 'Lini Test (Ubah)' });
  assert.equal(updated.lineName, 'Lini Test (Ubah)');

  const page = await apiClient.getProductionLinesPage({ limit: 50 });
  assert.ok(page.data.some((l) => l.lineId === 'LINE-T1'));

  // LINE-01 dipakai operator seed (SUP-042/OP-115) -> RESTRICT 409
  await assert.rejects(() => apiClient.deleteProductionLine('LINE-01'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, 'PRODUCTION_LINE_IN_USE');
    assert.equal(err.httpStatus, 409);
    return true;
  });

  const del = await apiClient.deleteProductionLine('LINE-T1');
  assert.equal(del.success, true);
  await assert.rejects(() => apiClient.getProductionLineById('LINE-T1'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.httpStatus, 404);
    return true;
  });
});

test('Demo CRUD Shifts + RESTRICT saat dipakai jadwal', async () => {
  const created = await apiClient.createShift({
    shiftId: 'SHIFT-T1',
    shiftName: 'Shift Test',
    shiftCode: 'ST',
    startTime: '08:00',
    endTime: '16:00',
  });
  assert.equal(created.shiftCode, 'ST');

  const updated = await apiClient.updateShift('SHIFT-T1', { shiftCode: 'ST2' });
  assert.equal(updated.shiftCode, 'ST2');

  // SHIFT-1 dipakai jadwal seed -> RESTRICT 409
  await assert.rejects(() => apiClient.deleteShift('SHIFT-1'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, 'SHIFT_IN_USE');
    assert.equal(err.httpStatus, 409);
    return true;
  });

  assert.equal((await apiClient.deleteShift('SHIFT-T1')).success, true);
});

test('Demo Shift Schedules: overlap 409 SHIFT_SCHEDULE_OVERLAP + CRUD', async () => {
  // Shift khusus yang jamnya menabrak SHIFT-1 (07:00-15:00)
  await apiClient.createShift({
    shiftId: 'SHIFT-T9',
    shiftName: 'Shift Tabrakan',
    shiftCode: 'S9',
    startTime: '10:00',
    endTime: '18:00',
  });
  const first = await apiClient.createShiftSchedule({ lineId: 'LINE-02', shiftId: 'SHIFT-1', dayOfWeek: 7 });
  assert.equal(first.scheduleId, 'sched-line-02-shift-1-d7');

  await assert.rejects(
    () => apiClient.createShiftSchedule({ lineId: 'LINE-02', shiftId: 'SHIFT-T9', dayOfWeek: 7 }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'SHIFT_SCHEDULE_OVERLAP');
      assert.equal(err.httpStatus, 409);
      return true;
    }
  );

  const moved = await apiClient.updateShiftSchedule(first.scheduleId, { dayOfWeek: 6 });
  assert.equal(moved.dayOfWeek, 6);

  const page = await apiClient.getShiftSchedulesPage({ line_id: 'LINE-02', day_of_week: 6 });
  assert.ok(page.data.some((s) => s.scheduleId === first.scheduleId));

  assert.equal((await apiClient.deleteShiftSchedule(first.scheduleId)).success, true);
  assert.equal((await apiClient.deleteShift('SHIFT-T9')).success, true);
});

test('HTTP transport vs stub server: login, retry 503, trailing slash, 409 tanpa retry', async () => {
  const seenPaths: string[] = [];
  const seenAuth: Array<string | undefined> = [];
  let devicesCalls = 0;
  let productsCalls = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3001');
    seenPaths.push(url.pathname);
    seenAuth.push(req.headers.authorization);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/devices') {
      devicesCalls += 1;
      if (devicesCalls <= 2) {
        json(503, { error: 'SERVICE_UNAVAILABLE', message: 'Backend sibuk.' });
        return;
      }
      json(200, [{ device_id: 'STM32-OEE-01', mac_address: 'AA:BB:CC:00:00:01', ip_address: null, firmware_version: '1.0' }]);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/operational-events/') {
      json(200, {
        data: [{ id: 'ev-1', device_id: 'STM32-OEE-01', event_type: 'INFO', timestamp: '2026-11-16T06:00:00.000Z' }],
        meta: { total_count: 1, has_more: false, next_cursor: null },
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/products') {
      productsCalls += 1;
      json(409, { error: 'PRODUCT_ALREADY_EXISTS', message: 'Product ID sudah ada.' });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3001, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');
    assert.equal(loggedIn.operator.id, 'ADM-001');

    // GET retry: 503, 503, lalu 200 — header Bearer terkirim
    const devices = await httpApiClient.getDevices();
    assert.equal(devicesCalls, 3);
    assert.equal(devices.length, 1);
    assert.equal(devices[0].device_id, 'STM32-OEE-01');
    assert.equal(devices[0].mac_address, 'AA:BB:CC:00:00:01');
    assert.ok(seenAuth.some((h) => h === 'Bearer stub-jwt'));

    // List operational events memakai trailing slash
    const eventsPage = await httpApiClient.getOperationalEventsPage({});
    assert.equal(eventsPage.data.length, 1);
    assert.ok(seenPaths.includes('/api/v1/operational-events/'));
    assert.equal(eventsPage.pagination.has_more, false);

    // 409 tidak di-retry (tepat 1 panggilan)
    await assert.rejects(
      () => httpApiClient.createProduct({ product_id: 'PRD-X', name: 'X', ideal_cycle_time_seconds: 30 }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, 'PRODUCT_ALREADY_EXISTS');
        assert.equal(err.httpStatus, 409);
        return true;
      }
    );
    assert.equal(productsCalls, 1);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// Audit env 2026-11-16: konfigurasi & switch sistem tinggal di env (mode.ts)
// ── Helper: set env sementara, kembalikan seperti semula di finally ────────
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  'VITE_API_MODE',
  'VITE_ALLOW_API_MODE_SWITCH',
  'VITE_DEMO_PRESET_LOGIN',
  'VITE_MUTATION_TIMEOUT_MS',
  'VITE_HTTP_RETRY_MAX_ATTEMPTS',
  'VITE_TUNNEL_PORT',
  'VITE_NETWORK_MODE',
  'VITE_ALLOW_NETWORK_MODE_SIMULATION',
  'VITE_LOGIN_MAX_ATTEMPTS',
  'VITE_LOGIN_COOLDOWN_SEC',
  'VITE_PLANT_LABEL',
  'VITE_DEFAULT_STATION_ID',
  'VITE_WS_HEARTBEAT_MS',
  'VITE_AUTH_TTL_FALLBACK_SEC',
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

test('Env mengunci mode (default): switch UI mati, VITE_API_MODE menang', () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    assert.equal(isApiModeSwitchAllowed(), false);
    assert.equal(isNetworkModeSimulationAllowed(), false);
    assert.equal(resolveApiMode(), 'demo');
    assert.equal(resolveEnvApiMode(), null);

    process.env.VITE_API_MODE = 'real';
    assert.equal(resolveApiMode(), 'real');
    assert.equal(resolveEnvApiMode(), 'real');
    // Preset login MATI di env real — sekalipun VITE_DEMO_PRESET_LOGIN=true.
    process.env.VITE_DEMO_PRESET_LOGIN = 'true';
    assert.equal(isDemoPresetLoginEnabled(), false);
  } finally {
    restoreEnv(snap);
  }
});

test('Env demo: preset login hidup; VITE_DEMO_PRESET_LOGIN=false mematikannya', () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.VITE_API_MODE = 'demo';
    assert.equal(resolveApiMode(), 'demo');
    assert.equal(isDemoPresetLoginEnabled(), true);

    process.env.VITE_DEMO_PRESET_LOGIN = 'false';
    assert.equal(isDemoPresetLoginEnabled(), false);

    // Switch tetap terkunci walau preset dimatikan — mode dari env.
    assert.equal(isApiModeSwitchAllowed(), false);
    assert.equal(resolveApiMode(), 'demo');
  } finally {
    restoreEnv(snap);
  }
});

test('Env switch dev: VITE_ALLOW_API_MODE_SWITCH=true membuka kunci', () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.VITE_API_MODE = 'demo';
    process.env.VITE_ALLOW_API_MODE_SWITCH = 'true';
    assert.equal(isApiModeSwitchAllowed(), true);
    // Tanpa query/localStorage (node), mode tetap dari env.
    assert.equal(resolveApiMode(), 'demo');
    assert.equal(isDemoPresetLoginEnabled(), true);

    process.env.VITE_ALLOW_NETWORK_MODE_SIMULATION = 'true';
    assert.equal(isNetworkModeSimulationAllowed(), true);
  } finally {
    restoreEnv(snap);
  }
});

test('Resolver env: timeout/retry/tunnel/network/lockout/identitas + default', () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    // Default saat env kosong (nilai Guide §4.2 / D1).
    assert.equal(resolveMutationTimeoutMs(), 15000);
    assert.equal(resolveHttpRetryMaxAttempts(), 3);
    assert.equal(resolveTunnelPort(), 8080);
    assert.equal(resolveNetworkMode(), 'LAN');
    assert.equal(resolveLoginMaxAttempts(), 5);
    assert.equal(resolveLoginCooldownSec(), 30);
    assert.equal(resolvePlantLabel(), 'Plant 01');
    assert.equal(resolveDefaultStationId(), 'ADMIN-CONSOLE-01');
    assert.equal(resolveWsHeartbeatMs(), 25000);
    assert.equal(resolveAuthTtlFallbackSec(), 900);

    // Override dari env terbaca.
    process.env.VITE_MUTATION_TIMEOUT_MS = '20000';
    process.env.VITE_HTTP_RETRY_MAX_ATTEMPTS = '5';
    process.env.VITE_TUNNEL_PORT = '8081';
    process.env.VITE_NETWORK_MODE = 'REMOTE_TUNNEL';
    process.env.VITE_LOGIN_MAX_ATTEMPTS = '3';
    process.env.VITE_LOGIN_COOLDOWN_SEC = '60';
    process.env.VITE_PLANT_LABEL = 'Plant 99';
    process.env.VITE_DEFAULT_STATION_ID = 'ST-1';
    process.env.VITE_WS_HEARTBEAT_MS = '10000';
    process.env.VITE_AUTH_TTL_FALLBACK_SEC = '600';
    assert.equal(resolveMutationTimeoutMs(), 20000);
    assert.equal(resolveHttpRetryMaxAttempts(), 5);
    assert.equal(resolveTunnelPort(), 8081);
    assert.equal(resolveNetworkMode(), 'REMOTE_TUNNEL');
    assert.equal(resolveLoginMaxAttempts(), 3);
    assert.equal(resolveLoginCooldownSec(), 60);
    assert.equal(resolvePlantLabel(), 'Plant 99');
    assert.equal(resolveDefaultStationId(), 'ST-1');
    assert.equal(resolveWsHeartbeatMs(), 10000);
    assert.equal(resolveAuthTtlFallbackSec(), 600);

    // Retry dijepit ke maks 5; nilai tak valid kembali ke default.
    process.env.VITE_HTTP_RETRY_MAX_ATTEMPTS = '99';
    assert.equal(resolveHttpRetryMaxAttempts(), 5);
    process.env.VITE_MUTATION_TIMEOUT_MS = 'bukan-angka';
    assert.equal(resolveMutationTimeoutMs(), 15000);
  } finally {
    restoreEnv(snap);
  }
});

test('Demo login TTL mengikuti VITE_AUTH_TTL_FALLBACK_SEC (bukan hardcoded 900)', async () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.VITE_AUTH_TTL_FALLBACK_SEC = '600';
    const res = await apiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(res.expires_in, 600);
    const refreshed = await apiClient.refreshSession();
    assert.equal(refreshed.expires_in, 600);
  } finally {
    restoreEnv(snap);
  }
});
