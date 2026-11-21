/**
 * Transport HTTP inti (Guide §4.2) — BARREL (FAT-285, E32.4).
 *
 * Dipisah dari satu file 575 baris (ambang batas keras 600) menjadi modul
 * per tanggung jawab di `transport/` — tanpa mengubah perilaku apa pun:
 *
 *   - `transport/types.ts` ...... `AuthClientHooks`, `HttpMethod`, `ReqOpts`, `RawResult`
 *   - `transport/session.ts` .... state token + sessionStorage (D5, FAT-280
 *     Opsi B, FAT-289 refresh token terpisah), `tokenAuthzVersion`,
 *     `networkMode`, `iamMode`, `calledKeys`, `hooks`, `httpCore`
 *   - `transport/errors.ts` ..... klasifikasi galat transport (FAT-227 MUT-01)
 *   - `transport/fetch.ts` ...... `fetchRaw` + retry/timeout, `fullUrl`,
 *     `sleep`, guard LAN (`assertLanForMutation`) + auth
 *   - `transport/requests.ts` ... `reqJson` / `reqList` / `reqAllPages` / `reqExport`
 *   - `mappers/workOrders.ts` ... `mapWorkOrder` (R10: mapper di `mappers/`)
 *
 * Semua impor lama (`./transport`) tetap jalan lewat re-export di bawah ini.
 *
 * Kontrak yang dipenuhi (Guide §4.2):
 * - Base URL: `VITE_API_URL` atau `origin + /api/v1`; `/health` tanpa prefix.
 * - Header `Authorization: Bearer <token>` disisipkan per panggilan; token
 *   di memori + sessionStorage (FAT-280 Opsi B — hidup selama tab
 *   terbuka, hilang saat tab ditutup; D5 diperbarui: tidak pernah ke
 *   localStorage/cookie/log).
 * - Timeout: baca 10 s, mutasi 15 s, ekspor 120 s (env §4.1).
 * - Retry HANYA untuk GET yang gagal jaringan / 502/503/504, maks 3x,
 *   backoff eksponensial + jitter. TIDAK retry 400/401/403/404/409/422/429
 *   dan TIDAK pernah retry mutasi non-idempoten.
 * - Normalisasi list: array langsung ATAU `{data, meta}` (D7).
 * - Error envelope `{error, message, issues?, active_wo_id?}` dipetakan
 *   terpusat via `mapHttpErrorToApiError` (§4.3); 401 → logout, 403 →
 *   capability diturunkan (AuthContext).
 * - Ekspor mengembalikan file (bukan envelope): baca `Content-Disposition`
 *   + header `X-Export-*`.
 * - `204 No Content` (hapus dynsec) tidak diharapkan berisi JSON.
 * - TIDAK ADA evaluasi policy/role/scope di klien (§4.5/§4.6h): server yang
 *   memutuskan; klien hanya meneruskan 403 ke capability store.
 *
 * Pemetaan casing: backend memakai campuran camelCase (devices, machines,
 * products, operators, live-state, telemetry) dan snake_case (work-orders,
 * downtime, operational-events). Mapper menormalkan keduanya ke
 * bentuk snake_case lokal yang dipakai seluruh halaman, sehingga pergantian
 * mode Demo ↔ Real tidak mengubah UI apa pun.
 */

export type { AuthClientHooks, HttpMethod, ReqOpts, RawResult } from './transport/types';

export {
  httpToken,
  HTTP_TOKEN_STORAGE_KEY,
  getStoredHttpToken,
  clearStoredHttpToken,
  httpRefreshToken,
  REFRESH_TOKEN_STORAGE_KEY,
  setRefreshToken,
  getStoredRefreshToken,
  clearStoredRefreshToken,
  setHttpToken,
  tokenAuthzVersion,
  setTokenAuthzVersion,
  networkMode,
  iamMode,
  calledKeys,
  hooks,
  httpCore,
} from './transport/session';

export type { ClassifiedTransportError } from './transport/errors';
export { classifyTransportError } from './transport/errors';

export {
  READ_TIMEOUT_FALLBACK,
  MUTATION_TIMEOUT_MS,
  MAX_ATTEMPTS,
  fullUrl,
  sleep,
  assertLanForMutation,
  assertAuthenticatedHttp,
  fetchRaw,
  checkAbortHttp,
} from './transport/fetch';

export { reqJson, reqList, reqAllPages, reqExport } from './transport/requests';

export { mapWorkOrder } from './mappers/workOrders';
