/**
 * Skema + helper transport HTTP (Guide §4.2/§4.3): envelope error, retry, normalisasi list.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { z } from 'zod';
import { ApiError, ApiErrorIssue } from '../../../types/auth';
import { CursorPageResponse } from '../../../types/historical';

export const NumericCoercionSchema = z
  .union([z.number(), z.string()])
  .transform((val) => {
    if (typeof val === 'number') return val;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  });

export const PaginationMetaSchema = z.object({
  // `limit` opsional: normalizer sudah fallback ke limit permintaan bila
  // backend tidak menyertakannya di meta (D7 — envelope boleh minimal).
  limit: z.number().int().nonnegative().optional(),
  hasMore: z.boolean().optional(),
  has_more: z.boolean().optional(),
  truncated: z.boolean().optional(),
  nextCursor: z.string().nullable().optional(),
  next_cursor: z.string().nullable().optional(),
  count: z.number().int().nonnegative().optional(),
  total_count: z.number().int().nonnegative().optional(),
});

export function normalizeListResponse<T>(
  rawPayload: unknown,
  itemSchema: z.ZodType<T>,
  fallbackLimit = 50
): CursorPageResponse<T> {
  if (Array.isArray(rawPayload)) {
    const parsedItems = z.array(itemSchema).safeParse(rawPayload);
    if (!parsedItems.success) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Format daftar data dari server tidak sesuai skema.',
        httpStatus: 200,
        issues: parsedItems.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }
    return {
      data: parsedItems.data,
      pagination: {
        limit: fallbackLimit,
        has_more: false,
        truncated: false,
        next_cursor: null,
        total_count: parsedItems.data.length,
      },
    };
  }

  const envelopeSchema = z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema.optional(),
    pagination: PaginationMetaSchema.optional(),
  });

  const parsedEnvelope = envelopeSchema.safeParse(rawPayload);
  if (!parsedEnvelope.success) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: 'Format envelope daftar data dari server tidak valid.',
      httpStatus: 200,
      issues: parsedEnvelope.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    });
  }

  const meta = parsedEnvelope.data.meta ?? parsedEnvelope.data.pagination;
  const hasMore = Boolean(meta?.hasMore ?? meta?.has_more ?? false);
  return {
    data: parsedEnvelope.data.data,
    pagination: {
      limit: meta?.limit ?? fallbackLimit,
      has_more: hasMore,
      truncated: Boolean(meta?.truncated ?? hasMore),
      next_cursor: meta?.nextCursor ?? meta?.next_cursor ?? null,
      total_count: meta?.total_count ?? meta?.count,
    },
  };
}

export const ApiErrorEnvelopeSchema = z.object({
  error: z.string().default('INTERNAL_SERVER_ERROR'),
  message: z.string().default('Terjadi kesalahan pada server.'),
  active_wo_id: z.string().optional(),
  issues: z
    .array(
      z.object({
        field: z.string().optional(),
        path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional(),
        code: z.string().optional(),
        message: z.string(),
      })
    )
    .optional(),
  // 422: `{error, issues, details:{validation}}` (§3.3b) — diteruskan, bukan dibuang (X30).
  details: z.unknown().optional(),
});

/**
 * Pemetaan error HTTP → ApiError. `retryAfterSec` diisi dari header
 * `Retry-After` respons 429 (server 5/60s, §L) — dibaca di fetchRaw.
 */
export function mapHttpErrorToApiError(httpStatus: number, rawBody?: unknown, retryAfterSec?: number): ApiError {
  if (httpStatus === 0) {
    return new ApiError({
      code: 'NETWORK',
      message: 'Koneksi jaringan terputus atau waktu tunggu habis.',
      httpStatus: 0,
    });
  }

  const parsed = ApiErrorEnvelopeSchema.safeParse(rawBody);
  const code = parsed.success ? parsed.data.error : fallbackCodeForStatus(httpStatus);
  const rawMessage = parsed.success ? parsed.data.message : '';
  const issues: ApiErrorIssue[] | undefined = parsed.success
    ? parsed.data.issues?.map((issue) => ({
        field: issue.field ?? (Array.isArray(issue.path) ? issue.path.join('.') : issue.path),
        code: issue.code,
        message: issue.message,
      }))
    : undefined;

  return new ApiError({
    code,
    message: rawMessage || defaultIndonesianErrorMessage(httpStatus, code),
    httpStatus,
    issues,
    activeWoId: parsed.success ? parsed.data.active_wo_id : undefined,
    retryAfterSec,
    details: parsed.success ? parsed.data.details : undefined,
  });
}

function fallbackCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'CONFIG_VALIDATION_FAILED';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 502:
      // §2: 502 = MQTT_PROVISION_FAILED.
      return 'MQTT_PROVISION_FAILED';
    case 503:
      // §2: 503 = DEVICE_OFFLINE / MQTT_UNAVAILABLE. Fallback generik tanpa
      // konteks body memakai MQTT_UNAVAILABLE (layanan tak terjangkau);
      // DEVICE_OFFLINE dikirim eksplisit oleh server bila perangkatnya offline.
      return 'MQTT_UNAVAILABLE';
    case 504:
      return 'MQTT_RESPONSE_TIMEOUT';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

export function defaultIndonesianErrorMessage(httpStatus: number, code: string): string {
  switch (httpStatus) {
    case 400:
      return 'Input tidak valid. Periksa kembali field formulir.';
    case 401:
      return 'Sesi telah berakhir atau token tidak valid. Silakan login ulang.';
    case 403:
      return 'Aksi ditolak oleh kebijakan akses atau perimeter jaringan.';
    case 404:
      return 'Data yang diminta tidak ditemukan.';
    case 409:
      return `Konflik bisnis (${code}): periksa relasi data aktif sebelum mengulang.`;
    case 422:
      return 'Validasi kandidat konfigurasi broker gagal.';
    case 429:
      return 'Terlalu banyak permintaan. Tunggu hitung mundur selesai sebelum mencoba lagi.';
    case 502:
      return 'Broker menolak perintah dynamic security.';
    case 503:
      return code === 'DEVICE_OFFLINE'
        ? 'Perangkat edge sedang offline (MQTT LWT).'
        : 'Layanan broker atau perangkat sedang tidak tersedia.';
    case 504:
      return 'Broker tidak merespons tepat waktu. Coba lagi secara manual.';
    default:
      return 'Kesalahan internal server. Catat waktu kejadian untuk pemeriksaan log.';
  }
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export async function retryIdempotentRead<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const status = err instanceof ApiError ? err.httpStatus : 0;
      if (!isRetryableHttpStatus(status) || attempt + 1 >= maxAttempts) {
        throw err;
      }
      const baseDelayMs = 200 * Math.pow(2, attempt);
      const jitterMs = Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs + jitterMs));
      attempt += 1;
    }
  }
  throw lastError;
}
