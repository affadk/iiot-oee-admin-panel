/**
 * Role operator adalah string bebas (API doc §H / §3.4, E20 P20.3):
 * bukan enum — `UNASSIGNED` bila belum ditetapkan, daftar otoritatif ada di
 * `GET /access-control/roles`. Nilai yang dikenal: ADMIN, SUPERVISOR,
 * OPERATOR, MAINTENANCE.
 */
export type UserRole = string;

export interface UserSession {
  operator_id: string;
  name: string;
  role: UserRole;
  line_id?: string;
  token: string;
  expires_at: number;
  authz_version?: number;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  expires_in: number;
  /** FAT-289: refresh token terpisah (opsional — backend lama tidak mengirim). */
  refresh_token?: string;
  refresh_expires_in?: number;
  operator: {
    id: string;
    username: string;
    role: UserRole;
    line_id?: string;
    /** Spec 043 (§L): true = password sementara, wajib ganti sebelum lanjut. */
    must_change_password?: boolean;
  };
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  expires_in: number;
  /** FAT-289: refresh token hasil rotasi (opsional — backend lama tidak mengirim). */
  refresh_token?: string;
  refresh_expires_in?: number;
  /** Spec 043 (§L): authzVersion hasil baca ulang identitas dari database. */
  authzVersion?: number;
}

export type NetworkAccessMode = 'LAN' | 'REMOTE_TUNNEL';

/**
 * Mode akses deployment (lihat `services/api/mode.ts` — satu-satunya sumber
 * kebenaran nilai env-nya):
 * - `private` (default): akses penuh HANYA dari LAN pabrik; via internet
 *   publik panel read-only.
 * - `public`: akses penuh diizinkan juga via internet publik (tunnel).
 */
export type AccessMode = 'private' | 'public';

export interface ApiErrorIssue {
  field?: string;
  path?: string;
  code?: string;
  message: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  httpStatus: number;
  issues?: ApiErrorIssue[];
  activeWoId?: string;
  /** Sisa detik dari header `Retry-After` respons 429 (server 5/60s, §L). */
  retryAfterSec?: number;
  /** Payload `details` mentah (mis. 422 `{validation}` — §3.3b). */
  details?: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly issues?: ApiErrorIssue[];
  public readonly activeWoId?: string;
  public readonly retryAfterSec?: number;
  public readonly details?: unknown;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.httpStatus = shape.httpStatus;
    this.issues = shape.issues;
    this.activeWoId = shape.activeWoId;
    this.retryAfterSec = shape.retryAfterSec;
    this.details = shape.details;
  }
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  active_wo_id?: string;
  issues?: ApiErrorIssue[];
}

export type AuthMeCapabilityDecision = 'allow' | 'deny' | 'unknown';

/** Satu entri capability dari GET /auth/me (bentuk array §L/§3.4). */
export interface AuthMeCapabilityEntry {
  key: string;
  domain?: string;
  surface?: string;
  decision: AuthMeCapabilityDecision;
  mode?: string;
  reason?: string;
}

export interface AuthMeResponse {
  operator: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
    isActive?: boolean;
    isProtected?: boolean;
    /** Spec 043 (§L): true = gerbang ganti-password-wajib aktif. */
    mustChangePassword?: boolean;
  };
  /** Tanpa default 'OPERATOR': absen = undefined (UI tampilkan UNASSIGNED). */
  primaryRole?: string;
  effectiveRoles: Array<{
    roleName: string;
    scopeType: string;
    scopeId: string | null;
  }>;
  authzVersion: number;
  catalogueVersion?: string;
  mode: 'shadow' | 'enforce' | 'partial';
  capabilities: Record<string, AuthMeCapabilityDecision>;
  /** Detail per-capability (domain/surface/mode/reason) bila server mengirim array. */
  capabilityDetails?: Record<string, AuthMeCapabilityEntry>;
  /** Atribut ABAC subjek dari `authz.attributes` (§3.4). */
  attributes?: Record<string, unknown>;
  /** Bentuk nested §3.4: `{mode, channel, mutations_allowed}`. */
  access?: {
    mode?: string;
    channel?: string;
    mutations_allowed?: boolean;
  };
}
