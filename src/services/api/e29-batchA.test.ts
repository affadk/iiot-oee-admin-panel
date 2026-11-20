/**
 * E29 Batch A (FAT-240/241/243, Spec 044) — migrasi login admin ke
 * POST /api/v1/auth/admin/login.
 *
 * - T1: registry AUTH_ADMIN_LOGIN + path lama di FORBIDDEN_ENDPOINT_PATTERNS.
 * - T2: login() HTTP body STRICT {operator_id, password} (tanpa station_id);
 *   401 generik diteruskan; 400 VALIDATION_ERROR bila body ber-station.
 * - T4: login() + refreshSession() lolos assertLanForMutation dalam kondisi
 *   Vercel (networkMode 'LAN', accessMode private) — verifikasi saja, TANPA
 *   pengecualian kode. Batasan env yang didokumentasikan: bila
 *   VITE_NETWORK_MODE=REMOTE_TUNNEL diset di dashboard Vercel, login mati
 *   403 (kasus terakhir di bawah membuktikannya).
 *
 * Stub server lokal port 3051 (3001–3050 + 3052–3059 sudah dipakai stub lain).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ADMIN_ENDPOINTS, FORBIDDEN_ENDPOINT_PATTERNS } from './endpoints';
import { httpApiClient } from './httpClient';
import { apiClient } from './client';
import { resolveNetworkMode, resolveEffectiveAccess } from './mode';
import { ApiError } from '../../types/auth';

const PORT = 3051;
const ENV_KEYS = ['VITE_ACCESS_MODE', 'VITE_ALLOW_ACCESS_MODE_SWITCH', 'VITE_API_MODE', 'VITE_API_URL', 'VITE_NETWORK_MODE'] as const;

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

test('T1: registry memuat AUTH_ADMIN_LOGIN; AUTH_LOGIN sudah dihapus', () => {
  assert.ok(!('AUTH_LOGIN' in ADMIN_ENDPOINTS), 'AUTH_LOGIN harus sudah dihapus dari registry');
  const def = ADMIN_ENDPOINTS.AUTH_ADMIN_LOGIN;
  assert.equal(def.key, 'AUTH_ADMIN_LOGIN');
  assert.equal(def.method, 'POST');
  assert.equal(def.template, '/api/v1/auth/admin/login');
  assert.equal(def.buildPath(), '/api/v1/auth/admin/login');
});

test('T1: path login lama ada di FORBIDDEN — dan TIDAK cocok dengan path baru', () => {
  assert.ok(
    (FORBIDDEN_ENDPOINT_PATTERNS as readonly string[]).includes('/api/v1/auth/login'),
    "FORBIDDEN_ENDPOINT_PATTERNS harus memuat '/api/v1/auth/login'",
  );
  // Penegakan memakai substring (store.recordEndpoint + contractAlignment):
  // pola full-path lama harus TIDAK cocok dengan path admin baru.
  assert.equal('/api/v1/auth/admin/login'.includes('/api/v1/auth/login'), false);
  // ...tapi tetap cocok dengan path lama itu sendiri.
  assert.equal('/api/v1/auth/login'.includes('/api/v1/auth/login'), true);
});

// --- Stub HTTP: mode 'ok' | 'unauthorized' | 'strict' -----------------------
type StubMode = 'ok' | 'unauthorized' | 'strict';
let stubMode: StubMode = 'ok';
let lastLoginBody: Record<string, unknown> | null = null;
let loginHits = 0;
let legacyLoginHits = 0;

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function withStubServer(fn: () => Promise<void>): Promise<void> {
  const snap = snapshotEnv();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
      loginHits += 1;
      const body = await readJsonBody(req);
      lastLoginBody = body;
      if (stubMode === 'unauthorized') {
        json(401, { error: 'UNAUTHORIZED', message: 'Invalid operator credentials' });
        return;
      }
      if (stubMode === 'strict' && 'station_id' in body) {
        json(400, { error: 'VALIDATION_ERROR', message: 'station_id is not allowed' });
        return;
      }
      json(200, {
        success: true,
        token: 'stub-jwt-e29',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
      json(200, { success: true, token: 'stub-jwt-e29-refresh', expires_in: 900, authzVersion: 1 });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      legacyLoginHits += 1;
      json(404, { error: 'NOT_FOUND', message: 'legacy login tidak lagi dilayani panel' });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  try {
    process.env.VITE_API_URL = `http://localhost:${PORT}/api/v1`;
    delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
    await fn();
  } finally {
    httpApiClient.setSessionActive(false, null);
    httpApiClient.setNetworkMode('LAN');
    restoreEnv(snap);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('T2: body request login STRICT {operator_id, password} — tanpa station_id; path lama tak pernah dipanggil', async () => {
  stubMode = 'ok';
  loginHits = 0;
  legacyLoginHits = 0;
  lastLoginBody = null;
  await withStubServer(async () => {
    httpApiClient.setNetworkMode('LAN');
    const res = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(res.token, 'stub-jwt-e29');
    assert.deepEqual(lastLoginBody, { operator_id: 'ADM-001', password: 'Admin@2026!' });
    assert.equal('station_id' in (lastLoginBody ?? {}), false);
    assert.equal(loginHits, 1);
    assert.equal(legacyLoginHits, 0, 'client tidak boleh memanggil /api/v1/auth/login lama');
  });
});

test('T2: 401 generik dari endpoint admin diteruskan apa adanya', async () => {
  stubMode = 'unauthorized';
  await withStubServer(async () => {
    httpApiClient.setNetworkMode('LAN');
    await assert.rejects(() => httpApiClient.login('ADM-001', 'SalahPassword!'), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'UNAUTHORIZED');
      assert.equal(err.httpStatus, 401);
      assert.equal(err.message, 'Invalid operator credentials');
      return true;
    });
  });
});

test('T2: stub strict menolak body ber-station 400 — tapi login() client tidak pernah memicunya', async () => {
  stubMode = 'strict';
  await withStubServer(async () => {
    httpApiClient.setNetworkMode('LAN');
    // Kontrol negatif: kirim langsung dengan station_id → server 400.
    const raw = await fetch(`http://localhost:${PORT}/api/v1/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator_id: 'ADM-001', password: 'Admin@2026!', station_id: 'ADMIN-CONSOLE-01' }),
    });
    assert.equal(raw.status, 400);
    const rawBody = (await raw.json()) as { error?: string };
    assert.equal(rawBody.error, 'VALIDATION_ERROR');

    // Client tidak pernah mengirim station_id → login lolos terhadap stub yang sama.
    const res = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(res.success, true);
    assert.equal('station_id' in (lastLoginBody ?? {}), false);
  });
});

test('T2: demo login tetap jalan tanpa station_id (paritas signature)', async () => {
  const snap = snapshotEnv();
  try {
    process.env.VITE_API_MODE = 'demo';
    apiClient.setNetworkMode('LAN');
    const res = await apiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(res.success, true);
    assert.equal(res.operator.id, 'ADM-001');
  } finally {
    apiClient.setNetworkMode('LAN');
    restoreEnv(snap);
  }
});

test('T4: kondisi Vercel — resolveNetworkMode() = LAN bila env kosong & port default', () => {
  const snap = snapshotEnv();
  try {
    delete process.env.VITE_NETWORK_MODE;
    // Node: window undefined → deteksi port terlewat → 'LAN'. Di Vercel
    // (https:443) window.location.port === '' → juga 'LAN', bukan tunnel.
    assert.equal(resolveNetworkMode(), 'LAN');
    const eff = resolveEffectiveAccess('LAN');
    assert.equal(eff.canMutate, true);
  } finally {
    restoreEnv(snap);
  }
});

test('T4: login() + refreshSession() lolos assertLanForMutation (LAN + private, kondisi Vercel)', async () => {
  stubMode = 'ok';
  const snap = snapshotEnv();
  try {
    delete process.env.VITE_NETWORK_MODE;
    delete process.env.VITE_ACCESS_MODE; // default private
    await withStubServer(async () => {
      httpApiClient.setNetworkMode('LAN');
      // Tanpa pengecualian bootstrap: gate lolos karena kanal terdeteksi LAN.
      const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
      assert.equal(loggedIn.token, 'stub-jwt-e29');
      const refreshed = await httpApiClient.refreshSession();
      assert.equal(refreshed.token, 'stub-jwt-e29-refresh');
      assert.equal(refreshed.authz_version, 1);
    });
  } finally {
    restoreEnv(snap);
  }
});

test('T4 (batasan env): REMOTE_TUNNEL + private MENOLAK login 403 sebelum fetch — VITE_NETWORK_MODE=REMOTE_TUNNEL di Vercel = login mati', async () => {
  stubMode = 'ok';
  loginHits = 0;
  await withStubServer(async () => {
    process.env.VITE_ACCESS_MODE = 'private';
    httpApiClient.setNetworkMode('REMOTE_TUNNEL');
    await assert.rejects(() => httpApiClient.login('ADM-001', 'Admin@2026!'), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'FORBIDDEN');
      assert.equal(err.httpStatus, 403);
      assert.match(err.message, /Mode observasi/);
      return true;
    });
    assert.equal(loginHits, 0, 'gate menolak SEBELUM fetch — stub tidak dipanggil');
  });
});
