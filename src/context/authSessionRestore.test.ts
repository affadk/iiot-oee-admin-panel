/**
 * FAT-280 Opsi B — sessionStorage + silent restore.
 *
 * - Persistensi transport: setHttpToken menulis tembus ke sessionStorage;
 *   logout (setSessionActive(false)) menghapus simpanan.
 * - restoreSessionFromStorage (client stub): tanpa token / token valid /
 *   token kedaluwarsa (401 → simpanan dihapus) / galat jaringan (simpanan
 *   dipertahankan) / getAuthMe gagal / TIDAK PERNAH melempar.
 * - Integrasi client HTTP asli + stub server lokal port 3061
 *   (3051 e29, 3031/3032/3060 sudah dipakai stub lain).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ApiError, type AuthMeResponse } from '../types/auth';
import {
  assertAuthenticatedHttp,
  clearStoredHttpToken,
  getStoredHttpToken,
  httpCore,
  setHttpToken,
} from '../services/api/http/transport';
import { httpApiClient } from '../services/api/httpClient';
import {
  restoreSessionFromStorage,
  type SessionRestoreClient,
} from './authSessionRestore';

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
  clearStoredHttpToken();
  storageMap.clear();
}

const fakeMe: AuthMeResponse = {
  operator: { operator_id: 'ADM-001', name: 'Admin', role: 'ADMIN', line_id: 'L1', mustChangePassword: false },
  effectiveRoles: [{ roleName: 'ADMIN', scopeType: 'ORGANIZATION', scopeId: null }],
  authzVersion: 3,
  mode: 'shadow',
  capabilities: {},
};

function fakeClient(overrides: Partial<SessionRestoreClient> = {}): SessionRestoreClient & {
  refreshCalls: number;
  meCalls: number;
} {
  let refreshCalls = 0;
  let meCalls = 0;
  const defaults: SessionRestoreClient = {
    refreshSession: async () => {
      refreshCalls++;
      return { token: 'rotated-token', expires_in: 900, authz_version: 3 };
    },
    getAuthMe: async () => {
      meCalls++;
      return fakeMe;
    },
  };
  const client = { ...defaults, ...overrides } as SessionRestoreClient & {
    refreshCalls: number;
    meCalls: number;
  };
  // Accessor (bukan Object.assign — assign akan membekukan nilai getter).
  Object.defineProperty(client, 'refreshCalls', { get: () => refreshCalls });
  Object.defineProperty(client, 'meCalls', { get: () => meCalls });
  return client;
}

test('FAT-280: setHttpToken menulis tembus ke sessionStorage; null menghapus', () => {
  resetState();
  setHttpToken('tok-abc');
  assert.equal(getStoredHttpToken(), 'tok-abc');
  setHttpToken(null);
  assert.equal(getStoredHttpToken(), null);
});

test('FAT-280: setSessionActive(false) = logout menghapus simpanan; (true, token) menyimpan', () => {
  resetState();
  httpCore.setSessionActive(true, 'tok-login');
  assert.equal(getStoredHttpToken(), 'tok-login');
  assert.doesNotThrow(() => assertAuthenticatedHttp());
  httpCore.setSessionActive(false, null);
  assert.equal(getStoredHttpToken(), null);
  assert.throws(() => assertAuthenticatedHttp(), (e: unknown) => e instanceof ApiError && e.httpStatus === 401);
});

test('FAT-280: restore tanpa token tersimpan → no-token, refresh tidak dipanggil', async () => {
  resetState();
  const client = fakeClient();
  const res = await restoreSessionFromStorage(client);
  assert.deepEqual(res, { ok: false, reason: 'no-token' });
  assert.equal(client.refreshCalls, 0);
  assert.equal(client.meCalls, 0);
});

test('FAT-280: restore token valid → ok + user terisi + token terotasi tersimpan', async () => {
  resetState();
  setHttpToken('old-token');
  const client = fakeClient();
  const res = await restoreSessionFromStorage(client);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.user, { operator_id: 'ADM-001', name: 'Admin', role: 'ADMIN', line_id: 'L1' });
  assert.equal(res.expiresIn, 900);
  assert.equal(res.mustChangePassword, false);
  assert.equal(client.refreshCalls, 1);
  assert.equal(client.meCalls, 1);
  // Token hasil rotasi sudah menggantikan token lama di simpanan + memori.
  assert.equal(getStoredHttpToken(), 'rotated-token');
  assert.doesNotThrow(() => assertAuthenticatedHttp());
});

test('FAT-280: restore token kedaluwarsa (401) → refresh-failed + simpanan dihapus + memori bersih', async () => {
  resetState();
  setHttpToken('expired-token');
  const client = fakeClient({
    refreshSession: async () => {
      throw new ApiError({ code: 'UNAUTHORIZED', message: 'Token kedaluwarsa.', httpStatus: 401 });
    },
  });
  const res = await restoreSessionFromStorage(client);
  assert.deepEqual(res, { ok: false, reason: 'refresh-failed' });
  assert.equal(getStoredHttpToken(), null);
  assert.throws(() => assertAuthenticatedHttp(), (e: unknown) => e instanceof ApiError && e.httpStatus === 401);
});

test('FAT-280: restore galat jaringan → refresh-failed TAPI simpanan dipertahankan', async () => {
  resetState();
  setHttpToken('old-token');
  const client = fakeClient({
    refreshSession: async () => {
      throw new Error('fetch failed');
    },
  });
  const res = await restoreSessionFromStorage(client);
  assert.deepEqual(res, { ok: false, reason: 'refresh-failed' });
  // Token mungkin masih valid — reload berikutnya boleh mencoba lagi.
  assert.equal(getStoredHttpToken(), 'old-token');
  assert.doesNotThrow(() => assertAuthenticatedHttp());
});

test('FAT-280: refresh ok tapi getAuthMe gagal → me-failed, simpanan dipertahankan', async () => {
  resetState();
  setHttpToken('old-token');
  const client = fakeClient({
    getAuthMe: async () => {
      throw new Error('fetch failed');
    },
  });
  const res = await restoreSessionFromStorage(client);
  assert.deepEqual(res, { ok: false, reason: 'me-failed' });
  assert.equal(getStoredHttpToken(), 'rotated-token');
});

test('FAT-280: restore TIDAK PERNAH melempar (respons refresh cacat)', async () => {
  resetState();
  setHttpToken('old-token');
  const client = fakeClient({
    refreshSession: async () => undefined as unknown as { token: string; expires_in: number; authz_version: number },
  });
  const res = await restoreSessionFromStorage(client);
  assert.deepEqual(res, { ok: false, reason: 'unexpected' });
});

// --- Integrasi: client HTTP asli + stub server ------------------------------
// Pola repo (e29-batchA): helper wrapper — server hidup hanya selama satu
// tes, lalu dibersihkan (setSessionActive(false), restore env,
// closeAllConnections + close).
type StubMode = 'ok' | 'unauthorized';
let stubMode: StubMode = 'ok';
let lastRefreshBody: unknown = null;

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

async function withStubServer(fn: () => Promise<void>, port = 3061): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/v1/auth/refresh') {
      lastRefreshBody = await readJsonBody(req);
      if (stubMode === 'unauthorized') {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Token kedaluwarsa.' });
        return;
      }
      sendJson(res, 200, { success: true, token: 'new-token', expires_in: 900, authzVersion: 3 });
      return;
    }
    if (req.method === 'GET' && req.url === '/api/v1/auth/me') {
      sendJson(res, 200, {
        operator: { id: 'ADM-001', username: 'Admin', must_change_password: false },
        authz: { primaryRole: 'ADMIN', authzVersion: 3, effectiveRoles: ['ADMIN'], capabilities: {} },
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
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
}

test('FAT-280 (integrasi): refresh asli mengirim JWT tersimpan → sesi pulih', async () => {
  await withStubServer(async () => {
    resetState();
    stubMode = 'ok';
    lastRefreshBody = null;
    setHttpToken('old-token');
    const res = await restoreSessionFromStorage(httpApiClient);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual((lastRefreshBody as { token?: unknown }).token, 'old-token');
    assert.equal(res.user.operator_id, 'ADM-001');
    assert.equal(res.user.role, 'ADMIN');
    assert.equal(getStoredHttpToken(), 'new-token');
  });
});

test('FAT-280 (integrasi): refresh asli 401 → sesi tidak pulih + simpanan dihapus', async () => {
  // Port 3062 (bukan 3061 seperti tes integrasi pertama): memakai ulang
  // port yang sama membuat request pertama menabrak koneksi keep-alive
  // mati dari server sebelumnya → galat NETWORK (httpStatus 0), bukan
  // 401 — simpanan dipertahankan dan tes gagal palsu.
  await withStubServer(async () => {
    resetState();
    stubMode = 'unauthorized';
    setHttpToken('expired-token');
    const res = await restoreSessionFromStorage(httpApiClient);
    assert.deepEqual(res, { ok: false, reason: 'refresh-failed' });
    assert.equal(getStoredHttpToken(), null);
  }, 3062);
});
