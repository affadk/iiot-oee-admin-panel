// E32.2 (FAT-283): dipecah dari modeAndTransport.test.ts — resolver
// mode/env (mode.ts) + TTL login demo mengikuti VITE_AUTH_TTL_FALLBACK_SEC.
// Kode sumber tidak diubah, hanya pemecahan file tes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from './client';
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
  resolvePlantLabel,
  resolveWsHeartbeatMs,
  resolveAuthTtlFallbackSec,
} from './mode';

test('Mode Demo vs Real (Guide §4.1): default demo, base URL fallback localhost:3001', () => {
  delete process.env.VITE_API_MODE;
  delete process.env.VITE_API_URL;
  assert.equal(resolveApiMode(), 'demo');
  assert.equal(resolveApiBaseUrl(), 'http://localhost:3001/api/v1');
  assert.equal(resolveOriginBaseUrl(), 'http://localhost:3001');
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
  'VITE_ACCESS_MODE',
  'VITE_ALLOW_ACCESS_MODE_SWITCH',
  'VITE_LOGIN_MAX_ATTEMPTS',
  'VITE_LOGIN_COOLDOWN_SEC',
  'VITE_PLANT_LABEL',
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

test('Resolver env: timeout/retry/tunnel/network/identitas + default (lockout DIHAPUS E20 P20.3)', () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    // Default saat env kosong (nilai Guide §4.2 / D1).
    assert.equal(resolveMutationTimeoutMs(), 15000);
    assert.equal(resolveHttpRetryMaxAttempts(), 3);
    assert.equal(resolveTunnelPort(), 8080);
    assert.equal(resolveNetworkMode(), 'LAN');
    assert.equal(resolvePlantLabel(), 'Plant 01');
    assert.equal(resolveWsHeartbeatMs(), 25000);
    assert.equal(resolveAuthTtlFallbackSec(), 900);

    // Override dari env terbaca.
    process.env.VITE_MUTATION_TIMEOUT_MS = '20000';
    process.env.VITE_HTTP_RETRY_MAX_ATTEMPTS = '5';
    process.env.VITE_TUNNEL_PORT = '8081';
    process.env.VITE_NETWORK_MODE = 'REMOTE_TUNNEL';
    process.env.VITE_PLANT_LABEL = 'Plant 99';
    process.env.VITE_WS_HEARTBEAT_MS = '10000';
    process.env.VITE_AUTH_TTL_FALLBACK_SEC = '600';
    assert.equal(resolveMutationTimeoutMs(), 20000);
    assert.equal(resolveHttpRetryMaxAttempts(), 5);
    assert.equal(resolveTunnelPort(), 8081);
    assert.equal(resolveNetworkMode(), 'REMOTE_TUNNEL');
    assert.equal(resolvePlantLabel(), 'Plant 99');
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
