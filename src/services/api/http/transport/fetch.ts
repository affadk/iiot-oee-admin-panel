/**
 * Fetch mentah transport HTTP (FAT-285, E32.4): fetchRaw + retry/timeout,
 * guard LAN, guard autentikasi.
 *
 * Dipisah dari `transport.ts` (575/600, ambang batas keras) tanpa mengubah
 * perilaku:
 * - Timeout: baca 10 s, mutasi 15 s, ekspor 120 s (env §4.1).
 * - Retry HANYA untuk GET yang gagal jaringan / 502/503/504, maks 3x,
 *   backoff eksponensial + jitter. TIDAK retry 400/401/403/404/409/422/429
 *   dan TIDAK pernah retry mutasi non-idempoten.
 * - `204 No Content` (hapus dynsec) tidak diharapkan berisi JSON.
 */
import { ApiError } from '../../../../types/auth';
import { resolveOriginBaseUrl, resolveRequestTimeoutMs, resolveMutationTimeoutMs, resolveHttpRetryMaxAttempts, resolveEffectiveAccess } from '../../mode';
import { mapHttpErrorToApiError, isRetryableHttpStatus } from '../../schemas';
import { httpToken, networkMode, hooks } from './session';
import { classifyTransportError } from './errors';
import type { RawResult, ReqOpts } from './types';

export const READ_TIMEOUT_FALLBACK = 10_000;

// Timeout mutasi + retry maks dibaca dari env (Guide §4.2) — bukan hardcoded.
// Dievaluasi sekali saat modul dimuat; env Vite adalah build-time.
export const MUTATION_TIMEOUT_MS = resolveMutationTimeoutMs();

export const MAX_ATTEMPTS = resolveHttpRetryMaxAttempts();

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
 * Guard tulis mode Real (D1 + mode akses Private/Public): mutasi hanya bila
 * akses efektif mengizinkan — LAN selalu boleh; tunnel hanya bila mode
 * `public`. Ini pertahanan lapis pertama; backend WAJIB menegakkan aturan
 * yang sama di server (lihat docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md).
 */
export function assertLanForMutation(): void {
  // networkMode adalah live binding dari session.ts — dibaca saat guard
  // dipanggil, bukan snapshot saat modul dimuat.
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

export function checkAbortHttp(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ApiError({ code: 'NETWORK', message: 'Permintaan dibatalkan.', httpStatus: 0 });
}
