/**
 * Mode akses Private/Public (2026-11-16, issue Linear A10.1).
 *
 * Matriks akses efektif (mode.ts `resolveEffectiveAccess`):
 *   LAN + private  -> boleh mutasi | LAN + public  -> boleh mutasi
 *   Tunnel + private -> READ-ONLY  | Tunnel + public -> boleh mutasi
 *
 * Penegakan diuji di tiga lapis: resolver murni, client demo (in-memory),
 * dan client HTTP (vs stub server lokal di port 3002 — port 3001 dipakai
 * modeAndTransport.test.ts), plus gerbang capability UI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient } from './client';
import { httpApiClient } from './httpClient';
import {
  isAccessModeSwitchAllowed,
  isMutationAllowed,
  resolveAccessMode,
  resolveEffectiveAccess,
  resolveEnvAccessMode,
  setAccessMode,
} from './mode';
import { evaluateCapability } from '../../utils/capabilities';
import { canPerformMutation } from '../../utils/oeeCalculations';
import { ApiError } from '../../types/auth';

const ENV_KEYS = ['VITE_ACCESS_MODE', 'VITE_ALLOW_ACCESS_MODE_SWITCH', 'VITE_API_MODE', 'VITE_API_URL'] as const;

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

test('Mode akses default: private; env public mengaktifkan; nilai invalid jatuh ke private', () => {
  const snap = snapshotEnv();
  try {
    delete process.env.VITE_ACCESS_MODE;
    delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
    assert.equal(isAccessModeSwitchAllowed(), false);
    assert.equal(resolveEnvAccessMode(), null);
    assert.equal(resolveAccessMode(), 'private');

    process.env.VITE_ACCESS_MODE = 'public';
    assert.equal(resolveEnvAccessMode(), 'public');
    assert.equal(resolveAccessMode(), 'public');

    process.env.VITE_ACCESS_MODE = '  PUBLIC  ';
    assert.equal(resolveAccessMode(), 'public');

    process.env.VITE_ACCESS_MODE = 'terbuka';
    assert.equal(resolveEnvAccessMode(), null);
    assert.equal(resolveAccessMode(), 'private');
  } finally {
    restoreEnv(snap);
  }
});

test('Switch terkunci (default): setAccessMode no-op; VITE_ALLOW_ACCESS_MODE_SWITCH=true membuka kunci', () => {
  const snap = snapshotEnv();
  try {
    delete process.env.VITE_ACCESS_MODE;
    delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
    assert.equal(isAccessModeSwitchAllowed(), false);
    setAccessMode('public'); // no-op di luar browser + saat terkunci — tidak throw
    assert.equal(resolveAccessMode(), 'private');

    process.env.VITE_ALLOW_ACCESS_MODE_SWITCH = 'true';
    assert.equal(isAccessModeSwitchAllowed(), true);
    process.env.VITE_ACCESS_MODE = 'public';
    assert.equal(resolveAccessMode(), 'public');
  } finally {
    restoreEnv(snap);
  }
});

test('Matriks akses efektif: LAN selalu boleh; tunnel hanya bila public', () => {
  const cases: Array<[Parameters<typeof resolveEffectiveAccess>[0], 'private' | 'public', boolean]> = [
    ['LAN', 'private', true],
    ['LAN', 'public', true],
    ['REMOTE_TUNNEL', 'private', false],
    ['REMOTE_TUNNEL', 'public', true],
  ];
  for (const [channel, mode, canMutate] of cases) {
    const snap = snapshotEnv();
    try {
      process.env.VITE_ACCESS_MODE = mode;
      delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
      const eff = resolveEffectiveAccess(channel);
      assert.equal(eff.canMutate, canMutate, `${channel}+${mode}`);
      assert.equal(eff.accessMode, mode);
      assert.equal(eff.channel, channel);
      assert.equal(isMutationAllowed(channel), canMutate, `isMutationAllowed ${channel}+${mode}`);
      if (!canMutate) assert.match(eff.reason, /Mode observasi/);
    } finally {
      restoreEnv(snap);
    }
  }
});

test('Demo: tunnel + private menolak login & mutasi 403; tunnel + public mengizinkan', async () => {
  const snap = snapshotEnv();
  try {
    process.env.VITE_API_MODE = 'demo';
    process.env.VITE_ACCESS_MODE = 'private';
    delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
    apiClient.setNetworkMode('REMOTE_TUNNEL');

    // Login sendiri sudah dijaga assertLanAccess.
    await assert.rejects(() => apiClient.login('ADM-001', 'Admin@2026!'), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'FORBIDDEN');
      assert.equal(err.httpStatus, 403);
      return true;
    });

    // Mode Public: login + mutasi lewat tunnel diizinkan.
    process.env.VITE_ACCESS_MODE = 'public';
    const loggedIn = await apiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.success, true);
    const created = await apiClient.createProductionLine({
      lineId: 'LINE-ACC-1',
      lineName: 'Lini Test Akses',
      description: 'Lini sementara untuk test mode akses',
    });
    assert.equal(created.lineId, 'LINE-ACC-1');

    // Kembali ke Private (masih tunnel, masih login): mutasi ditolak lagi.
    process.env.VITE_ACCESS_MODE = 'private';
    await assert.rejects(
      () => apiClient.createProductionLine({ lineId: 'LINE-ACC-2', lineName: 'Lini Test Akses 2' }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, 'FORBIDDEN');
        assert.equal(err.httpStatus, 403);
        return true;
      },
    );
    // ...tapi baca tetap jalan.
    const lines = await apiClient.getProductionLinesPage({ limit: 50 });
    assert.ok(lines.data.some((l) => l.lineId === 'LINE-ACC-1'));
  } finally {
    apiClient.setNetworkMode('LAN');
    restoreEnv(snap);
  }
});

test('HTTP: assertLanForMutation menolak sebelum fetch (private); public meneruskan ke backend', async () => {
  const snap = snapshotEnv();
  let productsCalls = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3002');
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
    if (req.method === 'POST' && url.pathname === '/api/v1/products') {
      productsCalls += 1;
      // Echo id/nama dari body request (client mengirim camelCase).
      let body: Record<string, unknown> = {};
      req.on('data', (chunk) => {
        try {
          body = { ...body, ...(JSON.parse(String(chunk)) as Record<string, unknown>) };
        } catch {
          // abaikan chunk yang bukan JSON
        }
      });
      req.on('end', () => {
        json(201, {
          productId: body.productId ?? 'PRD-ACC-1',
          productName: body.productName ?? 'Produk Test Akses',
          stdCycleTimeSec: body.stdCycleTimeSec ?? 30,
        });
      });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3002, resolve));
  try {
    process.env.VITE_API_MODE = 'demo'; // demo client tidak dipakai di sini; jaga-jaga
    process.env.VITE_API_URL = 'http://localhost:3002/api/v1';
    delete process.env.VITE_ALLOW_ACCESS_MODE_SWITCH;
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');

    // Tunnel + private: ditolak SEBELUM fetch (stub tidak dipanggil).
    process.env.VITE_ACCESS_MODE = 'private';
    httpApiClient.setNetworkMode('REMOTE_TUNNEL');
    await assert.rejects(
      () => httpApiClient.createProduct({ product_id: 'PRD-ACC-1', name: 'Produk Test Akses', ideal_cycle_time_seconds: 30 }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, 'FORBIDDEN');
        assert.equal(err.httpStatus, 403);
        return true;
      },
    );
    assert.equal(productsCalls, 0);

    // Tunnel + public: diteruskan ke backend stub.
    process.env.VITE_ACCESS_MODE = 'public';
    const created = await httpApiClient.createProduct({
      product_id: 'PRD-ACC-1',
      name: 'Produk Test Akses',
      ideal_cycle_time_seconds: 30,
    });
    assert.equal(created.product_id, 'PRD-ACC-1');
    assert.equal(productsCalls, 1);

    // LAN + private: boleh (aturan lama tidak berubah).
    process.env.VITE_ACCESS_MODE = 'private';
    httpApiClient.setNetworkMode('LAN');
    const created2 = await httpApiClient.createProduct({
      product_id: 'PRD-ACC-2',
      name: 'Produk Test Akses 2',
      ideal_cycle_time_seconds: 45,
    });
    assert.equal(created2.product_id, 'PRD-ACC-2');
    assert.equal(productsCalls, 2);
  } finally {
    httpApiClient.setSessionActive(false, null);
    httpApiClient.setNetworkMode('LAN');
    restoreEnv(snap);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Capability UI: requiresLan ditolak di tunnel+private, diizinkan di tunnel+public', () => {
  const denied = evaluateCapability('device.manage', {
    role: 'ADMIN',
    networkMode: 'REMOTE_TUNNEL',
    isAuthenticated: true,
  });
  assert.equal(denied.canInteract, false);
  assert.equal(denied.state, 'denied');
  assert.match(denied.reason ?? '', /Mode observasi/);

  const allowedPublic = evaluateCapability('device.manage', {
    role: 'ADMIN',
    networkMode: 'REMOTE_TUNNEL',
    accessMode: 'public',
    isAuthenticated: true,
  });
  assert.equal(allowedPublic.canInteract, true);
  // `device.manage` attributeDependent -> state `unknown` (boleh interaksi,
  // keputusan akhir di server). Yang penting: tidak lagi `denied` karena kanal.
  assert.equal(allowedPublic.state, 'unknown');

  // LAN + private tetap boleh (aturan lama).
  const allowedLan = evaluateCapability('device.manage', {
    role: 'ADMIN',
    networkMode: 'LAN',
    accessMode: 'private',
    isAuthenticated: true,
  });
  assert.equal(allowedLan.canInteract, true);

  // Helper canPerformMutation meneruskan mode akses (default private).
  assert.equal(canPerformMutation('ADMIN', 'REMOTE_TUNNEL', 'BROKER_CONFIG').allowed, false);
  assert.equal(canPerformMutation('ADMIN', 'REMOTE_TUNNEL', 'BROKER_CONFIG', 'public').allowed, true);
  assert.equal(canPerformMutation('ADMIN', 'LAN', 'BROKER_CONFIG').allowed, true);
});
