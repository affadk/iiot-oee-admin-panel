/**
 * Method HTTP — domain system.
 *
 * E20 P20.5 (FAT-157): `GET /api/v1/system/access-mode` (pembaruan API docs
 * 2026-11-19 09:23) — JWT wajib (tanpa token → 401). Panel memakai nilai
 * server bila tersedia (prefer server); bila endpoint tak tersedia
 * (404/401 pada backend lama), pemanggil (NetworkAccessContext) fallback
 * ke derivasi env+kanal. Konsumsi sisi panel SAJA — A10.2 belum terbuka.
 */
import { reqJson, checkAbortHttp, assertAuthenticatedHttp } from './transport';
import { bool, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { SystemAccessMode } from '../../../types/system';

export const httpSystem = {
  async getSystemAccessMode(signal?: AbortSignal): Promise<SystemAccessMode> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      // Tanpa `capability`: endpoint ini tidak punya kunci capability
      // kanonis di dokumen (hanya JWT) — 403 di sini ditangani pemanggil
      // sebagai "endpoint tak tersedia" (fallback env+kanal), bukan
      // penurunan capability.
      { path: ADMIN_ENDPOINTS.SYSTEM_ACCESS_MODE.buildPath(), signal, endpointKey: 'SYSTEM_ACCESS_MODE' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const mode = pick(r.mode) as string | undefined;
        const channel = pick(r.channel) as string | undefined;
        return {
          mode: mode === 'public' ? 'public' : 'private',
          channel: channel === 'lan' || channel === 'tunnel' || channel === 'unknown' ? channel : 'unknown',
          mutations_allowed: bool(pick(r.mutations_allowed, r.mutationsAllowed), false),
        };
      },
    );
  },
};
