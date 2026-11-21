/**
 * Mode API demo/real (FAT-285, E32.4).
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 *
 * Aturan prioritas mode API:
 *   - Switch TERKUNCI (default): mode = `VITE_API_MODE` atau `demo`.
 *     Query `?api=` dan localStorage DIABAIKAN — Topbar hanya menampilkan
 *     badge read-only. Inilah perilaku produksi.
 *   - Switch DIIZINKAN (`VITE_ALLOW_API_MODE_SWITCH=true`, hanya untuk
 *     dev/evaluasi lokal): query `?api=demo|real` > localStorage
 *     `iiot-oee-api-mode` > `VITE_API_MODE` > `demo`.
 */
import { readEnv, readEnvBool } from './env';

export type ApiMode = 'demo' | 'real';

export const API_MODE_STORAGE_KEY = 'iiot-oee-api-mode';

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
