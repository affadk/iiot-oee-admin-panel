/**
 * Timeout, retry, sesi (Guide §4.2 / §4.4) — FAT-285, E32.4.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 */
import { readEnvInt } from './env';

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
