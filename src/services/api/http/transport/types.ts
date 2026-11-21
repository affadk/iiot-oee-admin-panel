/**
 * Tipe transport HTTP — dipakai session/fetch/requests (FAT-285, E32.4).
 *
 * Dipisah dari `transport.ts` (575/600, ambang batas keras) tanpa mengubah
 * perilaku: hanya pemindahan tipe yang sudah ada ke modulnya sendiri.
 */
import type { AdminEndpointKey } from '../../endpoints';
import type { CapabilityKey } from '../../../../utils/capabilities';

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

export interface RawResult {
  status: number;
  text: string;
  json: unknown;
  headers: Headers;
}
