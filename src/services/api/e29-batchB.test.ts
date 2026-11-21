/**
 * E29 Batch B (FAT-245 T6 + FAT-242 T3, Spec 044) — refresh Real mode tanpa
 * gate LAN + verifikasi demo login tak berubah.
 *
 * - T6a: http refreshSession() TIDAK lagi memanggil assertLanForMutation —
 *   refresh lolos walau networkMode REMOTE_TUNNEL + private; changePassword
 *   TETAP digate 403 sebelum fetch (kontrol negatif).
 * - T6 demo: demo refreshSession() juga tanpa assertLanAccess — lolos walau
 *   store.networkAccessMode REMOTE_TUNNEL (login demo dulu saat LAN).
 * - T3: demo login tetap jalan tanpa station_id (paritas — bukan duplikat
 *   body-strict Batch A, hanya memastikan penghapusan shim/field tidak
 *   merusak jalur demo).
 *
 * Catatan batas tes: sliding refresh AuthContext (interval 1 detik, kondisi
 * `mode === 'LAN'` yang dihapus) TIDAK diuji via render — repo ini tidak
 * punya harness render React (tanpa testing-library/jsdom); yang diuji di
 * sini adalah prasyarat fungsionalnya (refreshSession ungated di kedua
 * transport) + penghapusan kondisi diverifikasi via grep/tsc (AUDIT §39).
 *
 * Stub server lokal port 3060 (3051 dipakai e29-batchA; 3001–3050 &
 * 3052–3059 sudah dipakai stub lain).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import { apiClient } from './client';
import { ApiError } from '../../types/auth';

const PORT = 3060;
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

let refreshHits = 0;
let changePasswordHits = 0;

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
      // 'Connection: close' — tanpa ini, socket keep-alive undici yang
      // sudah usang dipakai ulang tes berikutnya ke server stub baru di
      // port yang sama dan gagal UND_ERR_SOCKET (flaky, terbukti repro).
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
      await readJsonBody(req);
      json(200, {
        success: true,
        token: 'stub-jwt-e29b',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
      refreshHits += 1;
      await readJsonBody(req);
      json(200, { success: true, token: 'stub-jwt-e29b-refresh', expires_in: 900, authzVersion: 1 });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/password/change') {
      changePasswordHits += 1;
      await readJsonBody(req);
      json(200, { success: true, message: 'Password berhasil diperbarui.' });
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
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
}

test('T6a: refreshSession() HTTP lolos TANPA gate — REMOTE_TUNNEL + private tetap 200', async () => {
  refreshHits = 0;
  await withStubServer(async () => {
    process.env.VITE_ACCESS_MODE = 'private';
    // Login dulu saat LAN (login TETAP digate), lalu pindah ke tunnel.
    httpApiClient.setNetworkMode('LAN');
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt-e29b');
    httpApiClient.setNetworkMode('REMOTE_TUNNEL');
    const refreshed = await httpApiClient.refreshSession();
    assert.equal(refreshed.token, 'stub-jwt-e29b-refresh');
    assert.equal(refreshed.authz_version, 1);
    assert.equal(refreshHits, 1, 'refresh benar-benar mencapai stub (bukan ditolak gate)');
  });
});

test('T6a (kontrol negatif): changePassword TETAP digate 403 sebelum fetch — REMOTE_TUNNEL + private', async () => {
  changePasswordHits = 0;
  await withStubServer(async () => {
    process.env.VITE_ACCESS_MODE = 'private';
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    httpApiClient.setNetworkMode('REMOTE_TUNNEL');
    await assert.rejects(() => httpApiClient.changePassword('Admin@2026!', 'BaruPass123'), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'FORBIDDEN');
      assert.equal(err.httpStatus, 403);
      assert.match(err.message, /Mode observasi/);
      return true;
    });
    assert.equal(changePasswordHits, 0, 'gate menolak SEBELUM fetch — stub tidak dipanggil');
  });
});

test('T6 demo: refreshSession() demo lolos TANPA gate — REMOTE_TUNNEL tetap 200', async () => {
  const snap = snapshotEnv();
  try {
    process.env.VITE_API_MODE = 'demo';
    apiClient.setNetworkMode('LAN');
    const loggedIn = await apiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.success, true);
    apiClient.setNetworkMode('REMOTE_TUNNEL');
    const refreshed = await apiClient.refreshSession();
    assert.equal(refreshed.expires_in > 0, true);
    assert.ok(typeof refreshed.token === 'string' && refreshed.token.length > 0);
  } finally {
    apiClient.setSessionActive(false, null);
    apiClient.setNetworkMode('LAN');
    restoreEnv(snap);
  }
});

test('T3: demo login tetap jalan tanpa station_id (paritas — shim dihapus, jalur demo utuh)', async () => {
  const snap = snapshotEnv();
  try {
    process.env.VITE_API_MODE = 'demo';
    apiClient.setNetworkMode('LAN');
    const res = await apiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(res.success, true);
    assert.equal(res.operator.id, 'ADM-001');
    assert.equal(res.operator.role, 'ADMIN');
  } finally {
    apiClient.setSessionActive(false, null);
    apiClient.setNetworkMode('LAN');
    restoreEnv(snap);
  }
});
