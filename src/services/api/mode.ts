/**
 * Mode Demo vs Real — Build Guide §4.1 + API_DOCUMENTATION.md §1.
 *
 * Backend Fastify IIoT OEE belum tersedia saat panel ini dikembangkan, jadi
 * panel berjalan dalam mode Demo (store in-memory + data seed) secara default.
 * Begitu backend hidup, pindahkan ke mode Real tanpa mengubah satu pun
 * halaman: seluruh pemanggilan API lewat `apiClient` yang sama.
 *
 * Resolusi mode (prioritas tertinggi menang):
 *   1. Query string `?api=demo` / `?api=real` (sekali pakai, untuk mencoba)
 *   2. Pilihan tersimpan `localStorage['iiot-oee-api-mode']` (bukan token —
 *      hanya preferensi mode; token tetap hanya di memori, Guide D5)
 *   3. `VITE_API_MODE=demo|real` dari environment build
 *   4. Default: `demo`
 *
 * Base URL Real (Guide §4.1): `VITE_API_URL` bila diisi, jika tidak
 * `origin + /api/v1` (Nginx dual-vhost: port 80 LAN penuh, 8080 tunnel
 * read-only). Jangan hardcode host/port.
 */

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

export function resolveApiMode(): ApiMode {
  const fromQuery = readQueryMode();
  if (fromQuery) return fromQuery;
  const stored = readStoredMode();
  if (stored) return stored;
  const env = (readEnv('VITE_API_MODE') ?? '').trim().toLowerCase();
  if (env === 'real' || env === 'demo') return env;
  return 'demo';
}

/** Simpan preferensi mode (bukan kredensial) lalu muat ulang halaman. */
export function setApiMode(mode: ApiMode): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(API_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // abaikan — mode tetap berlaku untuk sesi ini via query
  }
}

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

export function resolveRequestTimeoutMs(): number {
  const v = Number(readEnv('VITE_REQUEST_TIMEOUT_MS') ?? 10000);
  return Number.isFinite(v) && v > 0 ? v : 10000;
}

export function resolveExportTimeoutMs(): number {
  const v = Number(readEnv('VITE_EXPORT_TIMEOUT_MS') ?? 120000);
  return Number.isFinite(v) && v > 0 ? v : 120000;
}

export function resolveAuthTtlFallbackSec(): number {
  const v = Number(readEnv('VITE_AUTH_TTL_FALLBACK_SEC') ?? 900);
  return Number.isFinite(v) && v > 0 ? v : 900;
}
