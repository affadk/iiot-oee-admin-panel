/**
 * State sesi transport HTTP (FAT-285, E32.4): token, mode jaringan, hook auth.
 *
 * Dipisah dari `transport.ts` (575/600, ambang batas keras) tanpa mengubah
 * perilaku — khususnya D5 token memory-only + sessionStorage (FAT-280
 * Opsi B, FAT-289 refresh token terpisah):
 * - Access token di memori (`httpToken`) + sessionStorage kunci
 *   `iiot-oee-access-token` (write-through; `null` menghapus simpanan).
 * - Refresh token di memori (`httpRefreshToken`) + sessionStorage kunci
 *   `iiot-oee-refresh-token` (write-through; `null` menghapus simpanan).
 * - Logout / 401 menghapus KEDUA token (lihat `httpCore.setSessionActive`).
 * - Token TIDAK PERNAH ke localStorage / cookie / log.
 */
import type { AdminEndpointKey } from '../../endpoints';
import type { NetworkAccessMode, UserRole } from '../../../../types/auth';
import type { AuthClientHooks } from './types';

export let httpToken: string | null = null;

/**
 * FAT-280 Opsi B: kunci penyimpanan access token di sessionStorage.
 * Konvensi nama mengikuti mode.ts (`iiot-oee-api-mode`,
 * `iiot-oee-access-mode`). sessionStorage — BUKAN localStorage: token
 * hidup selama tab terbuka dan hilang saat tab ditutup.
 */
export const HTTP_TOKEN_STORAGE_KEY = 'iiot-oee-access-token';

/** Akses sessionStorage yang aman — null di Node/tes atau bila storage dimatikan. */
function sessionStorageSafe(): Storage | null {
  try {
    // globalThis.sessionStorage ada di browser (window === globalThis) dan
    // bisa di-stub di tes Node; jangan pakai `window` langsung.
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/** Baca token tersimpan (dipakai silent restore saat boot, FAT-280). */
export function getStoredHttpToken(): string | null {
  const storage = sessionStorageSafe();
  if (!storage) return null;
  try {
    return storage.getItem(HTTP_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Hapus token tersimpan (logout / token kedaluwarsa, FAT-280). */
export function clearStoredHttpToken(): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  try {
    storage.removeItem(HTTP_TOKEN_STORAGE_KEY);
  } catch {
    // Abaikan — storage tidak tersedia.
  }
}

export let httpRefreshToken: string | null = null;

/**
 * FAT-289 (follow-up FAT-280): kunci penyimpanan refresh token TERPISAH
 * di sessionStorage — sama seperti access token: hidup selama tab
 * terbuka, hilang saat tab ditutup. Refresh token inilah yang membuat
 * silent restore tahan melewati kedaluwarsa access token (>900 dtk idle):
 * POST /auth/refresh memakai refresh token, bukan JWT yang sudah mati.
 * Opsional: backend lama tidak mengirim refresh_token → tidak ada yang
 * disimpan, perilaku persis seperti hari ini.
 */
export const REFRESH_TOKEN_STORAGE_KEY = 'iiot-oee-refresh-token';

/**
 * Setter refresh token (write-through ke sessionStorage, seperti
 * setHttpToken). `null` menghapus simpanan.
 */
export function setRefreshToken(token: string | null): void {
  httpRefreshToken = token;
  const storage = sessionStorageSafe();
  if (!storage) return;
  try {
    if (token) storage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    else storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Abaikan — storage tidak tersedia; sesi memori tetap berjalan.
  }
}

/** Baca refresh token tersimpan (dipakai silent restore + refreshSession). */
export function getStoredRefreshToken(): string | null {
  const storage = sessionStorageSafe();
  if (!storage) return null;
  try {
    return storage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Hapus refresh token tersimpan (logout / refresh 401, FAT-289). */
export function clearStoredRefreshToken(): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  try {
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Abaikan — storage tidak tersedia.
  }
}

/**
 * Setter token HTTP (dipakai login/refresh di http/auth.ts).
 * FAT-280 Opsi B: menulis tembus ke sessionStorage — token hidup selama
 * tab terbuka (silent restore saat reload); `null` menghapus simpanan.
 */
export function setHttpToken(token: string | null): void {
  httpToken = token;
  const storage = sessionStorageSafe();
  if (!storage) return;
  try {
    if (token) storage.setItem(HTTP_TOKEN_STORAGE_KEY, token);
    else storage.removeItem(HTTP_TOKEN_STORAGE_KEY);
  } catch {
    // Abaikan — storage tidak tersedia; sesi memori tetap berjalan.
  }
}

export let tokenAuthzVersion = 0;

/** Setter authzVersion token — diisi dari `authzVersion` respons refresh (§L). */
export function setTokenAuthzVersion(version: number): void {
  tokenAuthzVersion = version;
}

export let networkMode: NetworkAccessMode = 'LAN';

export let iamMode: 'shadow' | 'enforce' | 'partial' = 'shadow';

export const calledKeys = new Set<AdminEndpointKey>();

export const hooks: AuthClientHooks = {};

/** Method inti httpApiClient (sesi, mode jaringan, peran) — menutup state modul ini. */
export const httpCore = {
  setAuthHooks(h: AuthClientHooks) {
    hooks.onUnauthorized = h.onUnauthorized;
    hooks.onForbidden = h.onForbidden;
  },

  getCalledEndpointKeys(): AdminEndpointKey[] {
    return Array.from(calledKeys);
  },

  resetEndpointTracker() {
    calledKeys.clear();
  },

  setNetworkMode(mode: NetworkAccessMode) {
    networkMode = mode;
  },

  getNetworkMode(): NetworkAccessMode {
    return networkMode;
  },

  setUserRole(_role: UserRole) {
    // Mode Real: peran berasal dari token server (GET /auth/me). Tidak ada
    // pengalih peran lokal — itu hanya alat demo. Diam-diam abaikan agar
    // Topbar tidak dapat melewati otorisasi server.
  },

  getUserRole(): UserRole {
    return 'ADMIN';
  },

  setTokenAuthzVersion(version: number) {
    setTokenAuthzVersion(version);
  },

  setIamMode(mode: 'shadow' | 'enforce' | 'partial') {
    iamMode = mode;
  },

  setSessionActive(active: boolean, token?: string | null) {
    if (!active) {
      // Logout: bersihkan memori DAN simpanan sessionStorage (FAT-280)
      // — access token DAN refresh token terpisah (FAT-289).
      setHttpToken(null);
      setRefreshToken(null);
      tokenAuthzVersion = 0;
    } else if (token !== undefined && token !== null) {
      setHttpToken(token);
    }
  }
};
