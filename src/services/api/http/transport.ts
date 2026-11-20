/**
 * Transport HTTP inti (Guide §4.2): state token, fetchRaw + retry/timeout, reqJson/reqList/reqExport, guard LAN.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
/**
 * HTTP transport — mode Real (Build Guide §4.2, §4.3, §4.7).
 *
 * Dipakai hanya bila `VITE_API_MODE=real` (atau `?api=real` / pilihan di
 * Topbar). Seluruh halaman memanggil `apiClient` yang sama; transport ini
 * adalah implementasi alternatif dari store demo in-memory di `client.ts`.
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
 * downtime, operational-events). Mapper di bawah menormalkan keduanya ke
 * bentuk snake_case lokal yang dipakai seluruh halaman, sehingga pergantian
 * mode Demo ↔ Real tidak mengubah UI apa pun.
 */

import { num, str, bool, iso, pick, splitList, pageMeta } from './primitives';
import { AdminEndpointKey } from '../endpoints';
import { resolveOriginBaseUrl, resolveRequestTimeoutMs, resolveExportTimeoutMs, resolveMutationTimeoutMs, resolveHttpRetryMaxAttempts, resolveEffectiveAccess } from '../mode';
import { mapHttpErrorToApiError, isRetryableHttpStatus } from '../schemas';
import { parseExportMetadataHeaders } from '../../../utils/historicalExport';
import { ApiError, NetworkAccessMode, UserRole } from '../../../types/auth';
import { WorkOrder } from '../../../types/production';
import { CursorPageResponse, ExportResult } from '../../../types/historical';
import { CapabilityKey } from '../../../utils/capabilities';

export interface AuthClientHooks {
  onUnauthorized?: (reason?: string) => void;
  onForbidden?: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  /** Spec 043 (§L): gerbang ganti-password-wajib — 403 PASSWORD_ROTATION_REQUIRED. */
  onPasswordRotationRequired?: () => void;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ReqOpts {
  method?: HttpMethod;
  /** Path absolut: '/api/v1/...' atau '/health'. */
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  /** Timeout ms; default baca 10 s / mutasi 15 s (Guide §4.2). */
  timeoutMs?: number;
  /** Untuk atribusi 403 ke capability key (Guide §4.5). */
  capability?: CapabilityKey;
  resourceId?: string;
  /** Retry hanya untuk GET; default true bila method GET. */
  retry?: boolean;
  endpointKey?: AdminEndpointKey;
}

export const READ_TIMEOUT_FALLBACK = 10_000;

// Timeout mutasi + retry maks dibaca dari env (Guide §4.2) — bukan hardcoded.
// Dievaluasi sekali saat modul dimuat; env Vite adalah build-time.
export const MUTATION_TIMEOUT_MS = resolveMutationTimeoutMs();

export const MAX_ATTEMPTS = resolveHttpRetryMaxAttempts();

export function mapWorkOrder(raw: unknown): WorkOrder {
  const r = (raw ?? {}) as Record<string, unknown>;
  const woId = str(pick(r.wo_id, r.woId));
  return {
    wo_id: woId,
    order_number: str(pick(r.order_number, r.orderNumber, woId)),
    product_id: (pick(r.product_id, r.productId) as string | null) ?? null,
    product_name: (pick(r.product_name, r.productName) as string | null) ?? null,
    machine_id: (pick(r.machine_id, r.machineId) as string | null) ?? null,
    machine_name: (pick(r.machine_name, r.machineName) as string | null) ?? null,
    operator_id: (pick(r.operator_id, r.operatorId) as string | null) ?? null,
    operator_name: (pick(r.operator_name, r.operatorName) as string | null) ?? null,
    shift_name: str(pick(r.shift_name, r.shiftName, r.shift_code, r.shiftCode), ''),
    target_quantity: num(pick(r.target_qty, r.targetQty, r.target_quantity), 0),
    target_qty: num(pick(r.target_qty, r.targetQty), 0),
    status: (pick(r.status) as WorkOrder['status']) ?? 'PENDING',
    // E20 P20.5 (FAT-157): `planned_start` null bila tak ada — JANGAN
    // fallback ke `start_time` lalu `created_at`.
    planned_start: (pick(r.planned_start, r.plannedStart) as string | null) ?? null,
    start_time: (pick(r.start_time, r.startTime) as string | null) ?? null,
    end_time: (pick(r.end_time, r.endTime) as string | null) ?? null,
    // E20 P20.5 (FAT-157): nama kanonis §C — `actual_start_at` /
    // `actual_end_at`; alias lama `actual_start`/`actual_end` tetap
    // dibaca sebagai fallback (server lama), tapi tidak ditulis kembali.
    actual_start_at: (pick(r.actual_start_at, r.actualStartAt, r.actual_start, r.actualStart) as string | null) ?? null,
    actual_end_at: (pick(r.actual_end_at, r.actualEndAt, r.actual_end, r.actualEnd) as string | null) ?? null,
    dispatched_at: (pick(r.dispatched_at, r.dispatchedAt) as string | null) ?? null,
    acked_at: (pick(r.acked_at, r.ackedAt) as string | null) ?? null,
    provisional: bool(pick(r.provisional), false),
    count_uncertain: bool(pick(r.count_uncertain, r.countUncertain), false),
    notes: str(pick(r.notes), undefined) || undefined,
    cancel_reason: str(pick(r.cancel_reason, r.reason), undefined) || undefined,
  };
}

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

export let networkMode: NetworkAccessMode = 'LAN';

export let tokenAuthzVersion = 0;

export let iamMode: 'shadow' | 'enforce' | 'partial' = 'shadow';

export const calledKeys = new Set<AdminEndpointKey>();

export const hooks: AuthClientHooks = {};

export function fullUrl(path: string, query?: ReqOpts['query']): string {
  // Semua path sudah absolut dari origin (/api/v1/... atau /health).
  // resolveApiBaseUrl() SUDAH berakhiran /api/v1 — memakainya sebagai prefix
  // akan menggandakan prefix menjadi /api/v1/api/v1/... .
  const url = `${resolveOriginBaseUrl()}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * E28 Batch A (FAT-227 MUT-01): klasifikasi galat transport — pisahkan
 * tiga hal yang sebelumnya disamaratakan menjadi satu pesan "Koneksi
 * jaringan terputus atau backend tidak terjangkau.":
 * - `AbortError` (timeout/abort) → pesan waktu tunggu, BUKAN putus jaringan.
 * - `TypeError` dari fetch (gagal tersambung sama sekali) → pesan jaringan.
 * - Error lain (mis. body tak bisa di-serialize, bug klien) → kode
 *   TRANSPORT_ERROR + pesan yang JUJUR bahwa ini bukan putusnya jaringan.
 *   Tanpa pemisahan ini, galat apa pun pasca-mutasi tampil sebagai banner
 *   network-error palsu padahal mutasi sudah sukses di server.
 *
 * Catatan: respons HTTP (apa pun statusnya) TIDAK pernah sampai ke sini —
 * fetchRaw memetakan status non-2xx via mapHttpErrorToApiError sebelum
 * catch ini; respons 2xx kosong/sukses (`{success}`/204) juga bukan galat.
 */
export interface ClassifiedTransportError {
  code: string;
  message: string;
}

export function classifyTransportError(err: unknown): ClassifiedTransportError {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'AbortError') {
    return { code: 'NETWORK', message: 'Waktu tunggu habis. Periksa koneksi ke backend.' };
  }
  if (err instanceof TypeError) {
    return { code: 'NETWORK', message: 'Koneksi jaringan terputus atau backend tidak terjangkau.' };
  }
  return {
    code: 'TRANSPORT_ERROR',
    message: 'Gagal menghubungi backend: kesalahan tak terduga saat mengirim permintaan (bukan putusnya jaringan).',
  };
}

/**
 * Guard tulis mode Real (D1 + mode akses Private/Public): mutasi hanya bila
 * akses efektif mengizinkan — LAN selalu boleh; tunnel hanya bila mode
 * `public`. Ini pertahanan lapis pertama; backend WAJIB menegakkan aturan
 * yang sama di server (lihat docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md).
 */
export function assertLanForMutation(): void {
  const effective = resolveEffectiveAccess(networkMode);
  if (!effective.canMutate) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: effective.reason,
      httpStatus: 403,
    });
  }
}

export function assertAuthenticatedHttp(): void {
  if (!httpToken) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Sesi berakhir. Silakan login ulang.', httpStatus: 401 });
  }
}

export interface RawResult {
  status: number;
  text: string;
  json: unknown;
  headers: Headers;
}

export async function fetchRaw(opts: ReqOpts): Promise<RawResult> {
  const method = opts.method ?? 'GET';
  const isRead = method === 'GET';
  const timeoutMs = opts.timeoutMs ?? (isRead ? resolveRequestTimeoutMs() || READ_TIMEOUT_FALLBACK : MUTATION_TIMEOUT_MS);
  const shouldRetry = opts.retry ?? isRead;
  const maxAttempts = shouldRetry ? MAX_ATTEMPTS : 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        throw new ApiError({ code: 'NETWORK', message: 'Permintaan dibatalkan.', httpStatus: 0 });
      }
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      if (httpToken) headers.Authorization = `Bearer ${httpToken}`;
      const res = await fetch(fullUrl(opts.path, opts.query), {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      if (!res.ok) {
        const status = res.status;
        if (isRetryableHttpStatus(status) && attempt + 1 < maxAttempts) {
          await sleep(200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100));
          continue;
        }
        // §L: login 429 membawa `Retry-After: <sisa detik>` — satu-satunya
        // sumber kebenaran throttle (panel tanpa lockout paralel).
        const retryAfterRaw = res.headers.get('Retry-After');
        const retryAfterSec =
          retryAfterRaw !== null && retryAfterRaw.trim() !== '' && Number.isFinite(Number(retryAfterRaw))
            ? Math.max(0, Math.floor(Number(retryAfterRaw)))
            : undefined;
        const mapped = mapHttpErrorToApiError(status, json ?? undefined, retryAfterSec);
        if (mapped.code === 'PASSWORD_ROTATION_REQUIRED') {
          hooks.onPasswordRotationRequired?.();
        }
        throw mapped;
      }
      return { status: res.status, text, json, headers: res.headers };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      // E28 Batch A (FAT-227 MUT-01): klasifikasi via classifyTransportError
      // — jangan klaim "jaringan terputus" untuk galat yang bukan jaringan.
      const classified = classifyTransportError(err);
      const apiErr = new ApiError({
        code: classified.code,
        message: classified.message,
        httpStatus: 0,
      });
      lastError = apiErr;
      if (shouldRetry && attempt + 1 < maxAttempts) {
        await sleep(200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100));
        continue;
      }
      throw apiErr;
    }
  }
  throw lastError as ApiError;
}

/** JSON request + pemetaan error terpusat + hook 401/403 (Guide §4.3/§4.5). */
export async function reqJson<T>(opts: ReqOpts, parse?: (raw: unknown) => T): Promise<T> {
  try {
    const raw = await fetchRaw(opts);
    if (opts.endpointKey) calledKeys.add(opts.endpointKey);
    if (raw.status === 204 || !raw.text) return undefined as T;
    const data = raw.json;
    return parse ? parse(data) : (data as T);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.httpStatus === 401) {
        // §L: bedakan 401 AUTHZ_STALE (subjek stale → login ulang) dan 401
        // SUBJECT_INACTIVE (akun nonaktif) dari 401 umum — pesannya jelas.
        const reason =
          err.code === 'AUTHZ_STALE'
            ? 'Hak akses akun berubah (AUTHZ_STALE). Silakan login ulang.'
            : err.code === 'SUBJECT_INACTIVE'
              ? 'Akun operator nonaktif (SUBJECT_INACTIVE). Silakan hubungi administrator.'
              : err.message;
        hooks.onUnauthorized?.(reason);
      }
      // 403 hanya diturunkan ke capability bila panggilan membawa kunci
      // capability; tanpa kunci, tidak ada yang bisa diturunkan.
      if (err.httpStatus === 403 && opts.capability) {
        hooks.onForbidden?.(opts.capability, opts.resourceId, err.message);
      }
    }
    throw err;
  }
}

export async function reqList<T>(
  opts: ReqOpts,
  mapItem: (raw: unknown) => T,
  fallbackLimit = 50,
): Promise<CursorPageResponse<T>> {
  const raw = await reqJson<unknown>(opts);
  const { items, meta } = splitList(raw);
  const data = items.map((it) => mapItem(it));
  return { data, pagination: pageMeta(meta, fallbackLimit, data.length) };
}

export async function reqAllPages<T>(
  basePath: string,
  mapItem: (raw: unknown) => T,
  signal?: AbortSignal,
  endpointKey?: AdminEndpointKey,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res: CursorPageResponse<T> = await reqList(
      { path: basePath, query: { limit: 100, envelope: true, ...(cursor ? { cursor } : {}) }, signal, endpointKey },
      mapItem,
      100,
    );
    out.push(...res.data);
    cursor = res.pagination.next_cursor;
    if (!res.pagination.has_more || !cursor) break;
  }
  return out;
}

export async function reqExport(opts: ReqOpts, format: 'csv' | 'ndjson' | 'json', fallbackName: string): Promise<ExportResult> {
  const raw = await fetchRaw({ ...opts, timeoutMs: resolveExportTimeoutMs(), retry: false });
  if (opts.endpointKey) calledKeys.add(opts.endpointKey);
  const headers: Record<string, string> = {};
  raw.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const metadata = parseExportMetadataHeaders({
    'X-Export-Source': headers['x-export-source'],
    'X-Export-Generated-At': headers['x-export-generated-at'],
    'X-Export-Device-Id': headers['x-export-device-id'],
    'X-Export-Time-Window': headers['x-export-time-window'],
  });
  const disposition = headers['content-disposition'] ?? '';
  const nameMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const filename = nameMatch ? decodeURIComponent(nameMatch[1].trim()) : fallbackName;
  // E23 Batch 3 (FAT-193, N-24): spec live — 200 ekspor = application/json
  // STRING (bukan text/csv). Bila server meng-JSON-encode string CSV itu
  // (body diawali `"` dan diakhiri `"`), uraikan dulu ke teks CSV asli —
  // kalau tidak, CSV rusak (dikutip, escape `\n` literal, rowCount 0).
  // Teks CSV polos (bukan JSON valid / hasil parse bukan string) dipakai
  // apa adanya seperti sebelumnya.
  let content = raw.text;
  const trimmed = content.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const decoded: unknown = JSON.parse(trimmed);
      if (typeof decoded === 'string') content = decoded;
    } catch {
      // Bukan JSON — pakai teks mentah.
    }
  }
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const rowCount = format === 'csv' ? Math.max(0, lines.length - 1) : lines.length;
  return {
    filename,
    mimeType: headers['content-type'] ?? (format === 'csv' ? 'text/csv' : format === 'ndjson' ? 'application/x-ndjson' : 'application/json'),
    format,
    content,
    rowCount,
    metadata: { ...metadata, contentDisposition: disposition || undefined },
    endpoint: opts.path,
  };
}

export function checkAbortHttp(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ApiError({ code: 'NETWORK', message: 'Permintaan dibatalkan.', httpStatus: 0 });
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

/** Setter authzVersion token — diisi dari `authzVersion` respons refresh (§L). */
export function setTokenAuthzVersion(version: number): void {
  tokenAuthzVersion = version;
}

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
      // Logout: bersihkan memori DAN simpanan sessionStorage (FAT-280).
      setHttpToken(null);
      tokenAuthzVersion = 0;
    } else if (token !== undefined && token !== null) {
      setHttpToken(token);
    }
  }
};
