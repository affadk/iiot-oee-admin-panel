/**
 * FAT-289 — konsumsi refresh token terpisah (follow-up FAT-280).
 *
 * Client HTTP asli + stub server lokal (pola authSessionRestore.test.ts):
 * - login mengembalikan refresh_token → tersimpan (sessionStorage);
 *   login tanpa refresh_token (backend lama) → tidak ada yang disimpan,
 *   refresh token basi dari sesi sebelumnya terhapus.
 * - refreshSession memakai refresh_token tersimpan (body {refresh_token}),
 *   menyimpan hasil rotasi; tanpa refresh token → fallback body {token}
 *   persis seperti hari ini.
 * - refreshSession 401 → kedua token terhapus; tanpa token apa pun →
 *   401 tanpa request ke server.
 * Port segar per tes (3065–3070) — pelajaran FAT-280: reuse port →
 * galat NETWORK palsu dari koneksi keep-alive mati.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ApiError } from '../../../types/auth';
import {
  assertAuthenticatedHttp,
  clearStoredHttpToken,
  clearStoredRefreshToken,
  getStoredHttpToken,
  getStoredRefreshToken,
  setHttpToken,
  setRefreshToken,
} from './transport';
import { httpApiClient } from '../httpClient';

// --- Stub sessionStorage (Node tidak punya) ---------------------------------
const storageMap = new Map<string, string>();
const storageStub = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => {
    storageMap.set(k, v);
  },
  removeItem: (k: string) => {
    storageMap.delete(k);
  },
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};
(globalThis as { sessionStorage?: unknown }).sessionStorage = storageStub;

function resetState(): void {
  setHttpToken(null);
  setRefreshToken(null);
  clearStoredHttpToken();
  clearStoredRefreshToken();
  storageMap.clear();
}

// --- Stub server ------------------------------------------------------------
type LoginMode = 'with-refresh' | 'without-refresh';
type RefreshMode = 'ok' | 'unauthorized';
let loginMode: LoginMode = 'with-refresh';
let refreshMode: RefreshMode = 'ok';
// Bila true, /auth/refresh ikut mengembalikan refresh_token hasil rotasi.
let stubRotate = false;
let lastLoginBody: unknown = null;
let lastRefreshBody: unknown = null;
let refreshHits = 0;

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

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function withStubServer(fn: () => Promise<void>, port: number): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/v1/auth/admin/login') {
      lastLoginBody = await readJsonBody(req);
      sendJson(res, 200, {
        success: true,
        token: 'access-1',
        expires_in: 900,
        ...(loginMode === 'with-refresh'
          ? { refresh_token: 'rt-1', refresh_expires_in: 3600 }
          : {}),
        operator: { id: 'ADM-001', username: 'Admin', role: 'ADMIN' },
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/api/v1/auth/refresh') {
      refreshHits++;
      lastRefreshBody = await readJsonBody(req);
      if (refreshMode === 'unauthorized') {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Token kedaluwarsa.' });
        return;
      }
      sendJson(res, 200, {
        success: true,
        token: 'access-2',
        expires_in: 900,
        authzVersion: 3,
        ...(stubRotate ? { refresh_token: 'rt-2' } : {}),
      });
      return;
    }
    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Not found' });
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const prevApiUrl = process.env.VITE_API_URL;
  try {
    process.env.VITE_API_URL = `http://127.0.0.1:${port}`;
    await fn();
  } finally {
    httpApiClient.setSessionActive(false, null);
    stubRotate = false;
    refreshMode = 'ok';
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
}

test('FAT-289: login dengan refresh_token → refresh token tersimpan', async () => {
  await withStubServer(async () => {
    resetState();
    loginMode = 'with-refresh';
    const res = await httpApiClient.login('ADM-001', 'secret');
    assert.equal(res.token, 'access-1');
    assert.equal(res.refresh_token, 'rt-1');
    // Body login STRICT {operator_id, password} (Spec 044) — tanpa field lain.
    assert.deepEqual(lastLoginBody, { operator_id: 'ADM-001', password: 'secret' });
    assert.equal(getStoredHttpToken(), 'access-1');
    assert.equal(getStoredRefreshToken(), 'rt-1');
  }, 3065);
});

test('FAT-289: login tanpa refresh_token (backend lama) → tidak ada yang disimpan; refresh token basi terhapus', async () => {
  await withStubServer(async () => {
    resetState();
    loginMode = 'without-refresh';
    setRefreshToken('rt-stale');
    const res = await httpApiClient.login('ADM-001', 'secret');
    assert.equal(res.refresh_token, undefined);
    assert.equal(getStoredHttpToken(), 'access-1');
    assert.equal(getStoredRefreshToken(), null);
  }, 3066);
});

test('FAT-289: refreshSession memakai refresh_token tersimpan + menyimpan hasil rotasi', async () => {
  await withStubServer(async () => {
    resetState();
    stubRotate = true;
    lastRefreshBody = null;
    setHttpToken('access-1');
    setRefreshToken('rt-1');
    const res = await httpApiClient.refreshSession();
    assert.equal(res.token, 'access-2');
    assert.equal(res.expires_in, 900);
    // Refresh token dikirim dalam field {token} yang sama (kontrak lama).
    assert.deepEqual(lastRefreshBody, { token: 'rt-1' });
    assert.equal(getStoredHttpToken(), 'access-2');
    assert.equal(getStoredRefreshToken(), 'rt-2');
  }, 3067);
});

test('FAT-289: refreshSession tanpa refresh token → fallback body {token} (backend lama)', async () => {
  await withStubServer(async () => {
    resetState();
    stubRotate = false;
    lastRefreshBody = null;
    setHttpToken('access-1');
    const res = await httpApiClient.refreshSession();
    assert.equal(res.token, 'access-2');
    assert.deepEqual(lastRefreshBody, { token: 'access-1' });
    assert.equal(getStoredHttpToken(), 'access-2');
    assert.equal(getStoredRefreshToken(), null);
  }, 3068);
});

test('FAT-289: refreshSession 401 → kedua token terhapus (storage + memori)', async () => {
  await withStubServer(async () => {
    resetState();
    refreshMode = 'unauthorized';
    setHttpToken('access-1');
    setRefreshToken('rt-1');
    await assert.rejects(
      () => httpApiClient.refreshSession(),
      (e: unknown) => e instanceof ApiError && e.httpStatus === 401,
    );
    assert.equal(getStoredHttpToken(), null);
    assert.equal(getStoredRefreshToken(), null);
    assert.throws(() => assertAuthenticatedHttp(), (e: unknown) => e instanceof ApiError && e.httpStatus === 401);
  }, 3069);
});

test('FAT-289: refreshSession tanpa token apa pun → 401 tanpa request ke server', async () => {
  await withStubServer(async () => {
    resetState();
    refreshHits = 0;
    await assert.rejects(
      () => httpApiClient.refreshSession(),
      (e: unknown) => e instanceof ApiError && e.httpStatus === 401,
    );
    assert.equal(refreshHits, 0);
  }, 3070);
});
