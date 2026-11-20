/**
 * Konfigurasi sistem — SATU sumber kebenaran: environment build (`VITE_*`).
 *
 * Build Guide §4.1 + API_DOCUMENTATION.md §1. Semua switch & nilai sistem
 * yang menentukan perilaku deployment tinggal di sini dan dibaca dari env,
 * BUKAN dari hardcoded value di halaman atau dari tombol di UI:
 *
 *   - Mode API demo/real ............ `VITE_API_MODE` (default `demo`)
 *   - Boleh tidaknya mode diubah dari UI/query (`?api=` / localStorage)
 *     .............................. `VITE_ALLOW_API_MODE_SWITCH` (default `false` = TERKUNCI di env)
 *   - Preset login demo ............ `VITE_DEMO_PRESET_LOGIN` (default `true`,
 *     tapi OTOMATIS MATI bila `VITE_API_MODE=real` — lihat `isDemoPresetLoginEnabled`)
 *   - Endpoint / WS ................ `VITE_API_URL`, `VITE_WS_URL`
 *   - Timeout & retry (§4.2) ....... `VITE_REQUEST_TIMEOUT_MS` (10s),
 *     `VITE_MUTATION_TIMEOUT_MS` (15s), `VITE_EXPORT_TIMEOUT_MS` (120s),
 *     `VITE_HTTP_RETRY_MAX_ATTEMPTS` (3)
 *   - Sesi ......................... `VITE_AUTH_TTL_FALLBACK_SEC` (900)
 *   - Akses jaringan (D1 dual-vhost) `VITE_NETWORK_MODE` (`LAN`|`REMOTE_TUNNEL`,
 *     kosong = deteksi dari port), `VITE_TUNNEL_PORT` (8080),
 *     `VITE_ALLOW_NETWORK_MODE_SIMULATION` (default `false`)
 *   - Mode akses Private/Public ... `VITE_ACCESS_MODE` (`private`|`public`,
 *     default `private`), `VITE_ALLOW_ACCESS_MODE_SWITCH` (default `false`).
 *     Private = akses penuh HANYA dari LAN pabrik, via internet read-only.
 *     Public = akses penuh diizinkan juga via internet publik (tunnel).
 *     Penegakan ada di `assertLanAccess` (demo) & `assertLanForMutation`
 *     (HTTP) + `evaluateCapability` — lihat § "Mode akses" di bawah.
 *   - WebSocket .................... `VITE_WS_HEARTBEAT_MS` (25s),
 *     `VITE_WS_RECONNECT_MAX_MS` (30s), `VITE_DEMO_SIM_INTERVAL_MS` (5s)
 *   - Throttle login ............... DIHAPUS (E20 P20.3): server 5/60s
 *     (§L) satu-satunya throttle; panel TIDAK lockout paralel. Respons 429
 *     membawa header `Retry-After` yang ditampilkan ke pengguna.
 *   - Identitas deployment ......... `VITE_PLANT_LABEL` (`Plant 01`).
 *     (E29: `VITE_DEFAULT_STATION_ID` dihapus — login admin tidak lagi
 *     memakai station_id.)
 *
 * Aturan prioritas mode API:
 *   - Switch TERKUNCI (default): mode = `VITE_API_MODE` atau `demo`.
 *     Query `?api=` dan localStorage DIABAIKAN — Topbar hanya menampilkan
 *     badge read-only. Inilah perilaku produksi.
 *   - Switch DIIZINKAN (`VITE_ALLOW_API_MODE_SWITCH=true`, hanya untuk
 *     dev/evaluasi lokal): query `?api=demo|real` > localStorage
 *     `iiot-oee-api-mode` > `VITE_API_MODE` > `demo`.
 *
 * `VITE_*` adalah build-time: nilainya dibakar ke bundle saat `vite build`
 * dan BUKAN tempat rahasia — jangan taruh password/token di sini.
 * Token sesi tetap hanya di memori (Guide D5), tidak pernah di env.
 */

import type { AccessMode, NetworkAccessMode, UserRole } from '../../types/auth';

export type ApiMode = 'demo' | 'real';

export const API_MODE_STORAGE_KEY = 'iiot-oee-api-mode';

function readEnv(key: string): string | undefined {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv && typeof metaEnv[key] === 'string') return metaEnv[key];
  } catch {
    // import.meta.env tidak tersedia di luar Vite (mis. saat test via tsx)
  }
  try {
    const procEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (procEnv && typeof procEnv[key] === 'string') return procEnv[key];
  } catch {
    // abaikan
  }
  return undefined;
}

/** Baca env boolean: hanya string `true` (case-insensitive) yang berarti ya. */
function readEnvBool(key: string, fallback: boolean): boolean {
  const v = (readEnv(key) ?? '').trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

/** Baca env integer dengan fallback + batas bawah. */
function readEnvInt(key: string, fallback: number, min = 1): number {
  const v = Number(readEnv(key) ?? fallback);
  return Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;
}

function readQueryMode(): ApiMode | null {
  try {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('api');
    if (q === 'demo' || q === 'real') return q;
  } catch {
    // abaikan
  }
  return null;
}

function readStoredMode(): ApiMode | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(API_MODE_STORAGE_KEY);
    if (v === 'demo' || v === 'real') return v;
  } catch {
    // storage tidak tersedia / diblokir
  }
  return null;
}

/** Mode API mentah dari env saja (tanpa override runtime). `null` bila tidak diset. */
export function resolveEnvApiMode(): ApiMode | null {
  const env = (readEnv('VITE_API_MODE') ?? '').trim().toLowerCase();
  if (env === 'real' || env === 'demo') return env;
  return null;
}

/**
 * Apakah mode API boleh diubah dari UI (`Topbar`) / query `?api=` /
 * localStorage. Default TERKUNCI (`false`): env adalah satu-satunya sumber.
 * Set `VITE_ALLOW_API_MODE_SWITCH=true` hanya untuk dev/evaluasi lokal.
 */
export function isApiModeSwitchAllowed(): boolean {
  return readEnvBool('VITE_ALLOW_API_MODE_SWITCH', false);
}

export function resolveApiMode(): ApiMode {
  if (!isApiModeSwitchAllowed()) {
    // Terkunci: env menang atas segalanya; query + localStorage diabaikan.
    return resolveEnvApiMode() ?? 'demo';
  }
  const fromQuery = readQueryMode();
  if (fromQuery) return fromQuery;
  const stored = readStoredMode();
  if (stored) return stored;
  return resolveEnvApiMode() ?? 'demo';
}

/**
 * Simpan preferensi mode (bukan kredensial) lalu muat ulang halaman.
 * No-op bila switch terkunci di env — mode hanya bisa diubah lewat env.
 */
export function setApiMode(mode: ApiMode): void {
  if (!isApiModeSwitchAllowed()) return;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(API_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // abaikan — mode tetap berlaku untuk sesi ini via query
  }
}

// ---------------------------------------------------------------------------
// Preset login demo — HANYA hidup bila env demo
// ---------------------------------------------------------------------------

/** Akun seed demo yang boleh ditampilkan sebagai preset di halaman login. */
export const DEMO_PRESETS: Array<{ operatorId: string; role: UserRole; lineId: string; name: string }> = [
  { operatorId: 'ADM-001', role: 'ADMIN', lineId: 'ORG-ALL', name: 'Alexandria Vance' },
  { operatorId: 'SUP-042', role: 'SUPERVISOR', lineId: 'LINE-01', name: 'Marcus Reinhardt' },
  { operatorId: 'OP-115', role: 'OPERATOR', lineId: 'LINE-01', name: 'Kenji Sato' },
  { operatorId: 'MNT-208', role: 'MAINTENANCE', lineId: 'LINE-02', name: 'Elena Rostova' },
];

/**
 * Pengisi password form preset. BUKAN kredensial nyata — login demo menerima
 * password apa pun ≥8 karakter (§L, E20 P20.3 — fallback min 4 DIHAPUS);
 * string ini hanya pengisi form agar preset bisa dipakai satu klik.
 */
export const DEMO_PRESET_PASSWORD = 'Factory@2026!';

/**
 * Preset login demo aktif HANYA bila SEMUA syarat terpenuhi:
 *   1. mode efektif saat ini `demo`, DAN
 *   2. env `VITE_API_MODE` BUKAN `real` (jadi preset MATI di env `!demo`,
 *      sekalipun mode sempat dialihkan ke demo lewat switch dev), DAN
 *   3. `VITE_DEMO_PRESET_LOGIN` tidak dimatikan eksplisit (`false`).
 * Di mode Real tidak ada prefill operator/password dan tidak ada tombol preset.
 */
export function isDemoPresetLoginEnabled(): boolean {
  if (resolveApiMode() !== 'demo') return false;
  if (resolveEnvApiMode() === 'real') return false;
  return readEnvBool('VITE_DEMO_PRESET_LOGIN', true);
}

// ---------------------------------------------------------------------------
// Endpoint / WebSocket
// ---------------------------------------------------------------------------

export function resolveApiBaseUrl(): string {
  const envUrl = (readEnv('VITE_API_URL') ?? '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:3001/api/v1';
}

/** Base URL tanpa suffix `/api/v1` — untuk `/health` dan WS. */
export function resolveOriginBaseUrl(): string {
  const api = resolveApiBaseUrl();
  return api.endsWith('/api/v1') ? api.slice(0, -'/api/v1'.length) : api;
}

export function resolveWsUrl(): string {
  const envUrl = (readEnv('VITE_WS_URL') ?? '').trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/telemetry`;
  }
  return 'ws://localhost/ws/telemetry';
}

// ---------------------------------------------------------------------------
// Timeout, retry, sesi (Guide §4.2 / §4.4)
// ---------------------------------------------------------------------------

export function resolveRequestTimeoutMs(): number {
  return readEnvInt('VITE_REQUEST_TIMEOUT_MS', 10000);
}

/** Timeout mutasi HTTP (Guide §4.2: 15s). Sebelumnya hardcoded di httpClient. */
export function resolveMutationTimeoutMs(): number {
  return readEnvInt('VITE_MUTATION_TIMEOUT_MS', 15000);
}

export function resolveExportTimeoutMs(): number {
  return readEnvInt('VITE_EXPORT_TIMEOUT_MS', 120000);
}

/** Maksimal percobaan HTTP untuk GET yang retryable (Guide §4.2: 3). */
export function resolveHttpRetryMaxAttempts(): number {
  const v = readEnvInt('VITE_HTTP_RETRY_MAX_ATTEMPTS', 3);
  return Math.min(v, 5);
}

export function resolveAuthTtlFallbackSec(): number {
  return readEnvInt('VITE_AUTH_TTL_FALLBACK_SEC', 900);
}

// ---------------------------------------------------------------------------
// Akses jaringan — dual-vhost D1 (port 80 LAN penuh, tunnel read-only)
// ---------------------------------------------------------------------------

/** Port tunnel read-only (Guide D1). Sebelumnya hardcoded `8080` di context. */
export function resolveTunnelPort(): number {
  return readEnvInt('VITE_TUNNEL_PORT', 8080);
}

/**
 * Mode akses jaringan: override eksplisit `VITE_NETWORK_MODE` menang;
 * bila kosong, deteksi dari port (port tunnel → REMOTE_TUNNEL, lainnya LAN).
 */
export function resolveNetworkMode(): NetworkAccessMode {
  const override = (readEnv('VITE_NETWORK_MODE') ?? '').trim().toUpperCase();
  if (override === 'LAN' || override === 'REMOTE_TUNNEL') return override;
  try {
    if (typeof window !== 'undefined' && window.location.port === String(resolveTunnelPort())) {
      return 'REMOTE_TUNNEL';
    }
  } catch {
    // abaikan
  }
  return 'LAN';
}

/**
 * Apakah banner boleh menampilkan tombol simulasi pergantian mode jaringan
 * ("Mode Remote Tunnel" / "Kembali ke LAN"). Default MATI (`false`):
 * mode jaringan berasal dari env/deployment, bukan dari klik di UI —
 * tombol simulasi bisa mengklaim LAN palsu dari tunnel dan mengaktifkan
 * kembali mutasi yang seharusnya nonaktif. Nyalakan hanya untuk dev lokal.
 */
export function isNetworkModeSimulationAllowed(): boolean {
  return readEnvBool('VITE_ALLOW_NETWORK_MODE_SIMULATION', false);
}

// ---------------------------------------------------------------------------
// Mode akses Private / Public — akses penuh via LAN vs via internet publik
// ---------------------------------------------------------------------------

/**
 * Mode akses deployment:
 * - `private` (default): akses penuh HANYA dari LAN pabrik. Lewat internet
 *   publik (tunnel) panel read-only — mutasi ditolak 403 baik di client
 *   (`assertLanAccess`/`assertLanForMutation`) maupun di UI (`isReadOnly`).
 * - `public`: akses penuh diizinkan juga via internet publik (tunnel).
 *   Dipakai bila pabrik memang membuka panel ke internet — keputusan sadar,
 *   bukan default, karena memperluas permukaan serangan.
 * Tipe `AccessMode` tinggal di `types/auth.ts` (dipakai juga capability).
 */
export type { AccessMode } from '../../types/auth';

export const ACCESS_MODE_STORAGE_KEY = 'iiot-oee-access-mode';

function readQueryAccessMode(): AccessMode | null {
  try {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('access');
    if (q === 'private' || q === 'public') return q;
  } catch {
    // abaikan
  }
  return null;
}

function readStoredAccessMode(): AccessMode | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(ACCESS_MODE_STORAGE_KEY);
    if (v === 'private' || v === 'public') return v;
  } catch {
    // storage tidak tersedia / diblokir
  }
  return null;
}

/** Mode akses mentah dari env saja (tanpa override runtime). `null` bila tidak diset. */
export function resolveEnvAccessMode(): AccessMode | null {
  const env = (readEnv('VITE_ACCESS_MODE') ?? '').trim().toLowerCase();
  if (env === 'public' || env === 'private') return env;
  return null;
}

/**
 * Apakah mode akses boleh diubah dari UI (`Topbar`) / query `?access=` /
 * localStorage. Default TERKUNCI (`false`): env adalah satu-satunya sumber.
 * Set `VITE_ALLOW_ACCESS_MODE_SWITCH=true` hanya untuk dev/evaluasi lokal —
 * di produksi perubahan mode = ubah env lalu build/deploy ulang, supaya
 * perubahan tercatat di deployment, bukan klik diam-diam di browser.
 */
export function isAccessModeSwitchAllowed(): boolean {
  return readEnvBool('VITE_ALLOW_ACCESS_MODE_SWITCH', false);
}

export function resolveAccessMode(): AccessMode {
  if (!isAccessModeSwitchAllowed()) {
    // Terkunci: env menang atas segalanya; query + localStorage diabaikan.
    return resolveEnvAccessMode() ?? 'private';
  }
  const fromQuery = readQueryAccessMode();
  if (fromQuery) return fromQuery;
  const stored = readStoredAccessMode();
  if (stored) return stored;
  return resolveEnvAccessMode() ?? 'private';
}

/**
 * Simpan preferensi mode akses (bukan kredensial) lalu muat ulang halaman.
 * No-op bila switch terkunci di env — mode hanya bisa diubah lewat env.
 */
export function setAccessMode(mode: AccessMode): void {
  if (!isAccessModeSwitchAllowed()) return;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // abaikan — mode tetap berlaku untuk sesi ini via query
  }
}

export interface EffectiveAccess {
  accessMode: AccessMode;
  channel: NetworkAccessMode;
  /** Boleh mutasi (tulis) pada kombinasi mode + kanal ini. */
  canMutate: boolean;
  /** Penjelasan singkat untuk banner/Topbar — kenapa read-only atau tidak. */
  reason: string;
}

/**
 * Pesan penolakan gate LAN klien — satu sumber kebenaran. Dipakai
 * assertLanForMutation (HTTP) dan assertLanAccess (demo) lewat
 * resolveEffectiveAccess, dan dipakai LoginPage sebagai pembeda 403
 * gate-lokal vs 403 server (E29 FAT-244, T5 — lihat komentar di bawah).
 */
export const LAN_GATE_DENY_REASON =
  'Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik.';

/**
 * Akses efektif dari kombinasi mode akses + kanal jaringan saat ini.
 * Matriks: LAN selalu boleh mutasi; tunnel hanya bila mode `public`.
 */
export function resolveEffectiveAccess(channel: NetworkAccessMode): EffectiveAccess {
  const accessMode = resolveAccessMode();
  if (channel === 'LAN') {
    return {
      accessMode,
      channel,
      canMutate: true,
      reason:
        accessMode === 'public'
          ? 'Mode Public — akses penuh dari LAN; akses penuh juga diizinkan via internet publik.'
          : 'Mode Private — akses penuh dari LAN pabrik.',
    };
  }
  if (accessMode === 'public') {
    return {
      accessMode,
      channel,
      canMutate: true,
      reason: 'Mode Public — akses penuh diizinkan via internet publik (tunnel).',
    };
  }
  return {
    accessMode,
    channel,
    canMutate: false,
    // Copy penolakan dipertahankan dari perilaku lama (D1) supaya pesan yang
    // sudah diuji & dikenal operator tidak berubah: "Mode observasi".
    // E29 (FAT-244, T5): string ini SATU-SATUNYA penanda andal bahwa sebuah
    // ApiError 403 berasal dari gate LAN klien (assertLanForMutation /
    // assertLanAccess) dan BUKAN dari server — kedua guard melempar ApiError
    // dengan message ini verbatim, sebelum fetch; server tidak pernah
    // mengirim string Indonesia ini (pesan server berbahasa Inggris).
    // LoginPage membedakan keduanya dengan membandingkan message terhadap
    // LAN_GATE_DENY_REASON (lihat mapLoginForbiddenMessage).
    reason: LAN_GATE_DENY_REASON,
  };
}

/** Jalan pintas: boleh mutasi pada kanal ini? Default kanal = deteksi saat ini. */
export function isMutationAllowed(channel: NetworkAccessMode = resolveNetworkMode()): boolean {
  return resolveEffectiveAccess(channel).canMutate;
}

// ---------------------------------------------------------------------------
// WebSocket: heartbeat, reconnect, simulasi demo
// ---------------------------------------------------------------------------

/** Interval heartbeat WS mode Real (Guide: 25s). */
export function resolveWsHeartbeatMs(): number {
  return readEnvInt('VITE_WS_HEARTBEAT_MS', 25000);
}

/** Batas atas backoff reconnect WS (30s). */
export function resolveWsReconnectMaxMs(): number {
  return readEnvInt('VITE_WS_RECONNECT_MAX_MS', 30000);
}

/** Interval emisi simulasi telemetri mode Demo (5s). */
export function resolveDemoSimIntervalMs(): number {
  return readEnvInt('VITE_DEMO_SIM_INTERVAL_MS', 5000);
}

// ---------------------------------------------------------------------------
// Login: identitas deployment
// ---------------------------------------------------------------------------

/** Label plant yang tampil di Topbar (`Plant 01`). */
export function resolvePlantLabel(): string {
  return (readEnv('VITE_PLANT_LABEL') ?? '').trim() || 'Plant 01';
}
