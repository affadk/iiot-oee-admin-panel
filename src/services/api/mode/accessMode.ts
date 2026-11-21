/**
 * Mode akses Private / Public — akses penuh via LAN vs via internet publik.
 * FAT-285, E32.4.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 *
 * Mode akses deployment:
 * - `private` (default): akses penuh HANYA dari LAN pabrik. Lewat internet
 *   publik (tunnel) panel read-only — mutasi ditolak 403 baik di client
 *   (`assertLanAccess`/`assertLanForMutation`) maupun di UI (`isReadOnly`).
 * - `public`: akses penuh diizinkan juga via internet publik (tunnel).
 *   Dipakai bila pabrik memang membuka panel ke internet — keputusan sadar,
 *   bukan default, karena memperluas permukaan serangan.
 * Tipe `AccessMode` tinggal di `types/auth.ts` (dipakai juga capability).
 */
import type { AccessMode, NetworkAccessMode } from '../../../types/auth';
import { readEnv, readEnvBool } from './env';
import { resolveNetworkMode } from './network';

export type { AccessMode } from '../../../types/auth';

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
