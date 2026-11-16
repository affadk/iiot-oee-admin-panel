export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE';

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
  operator: {
    id: string;
    username: string;
    role: UserRole;
    line_id?: string;
  };
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  expires_in: number;
}

export type NetworkAccessMode = 'LAN' | 'REMOTE_TUNNEL';

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
}

export class ApiError extends Error implements ApiErrorShape {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly issues?: ApiErrorIssue[];
  public readonly activeWoId?: string;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.httpStatus = shape.httpStatus;
    this.issues = shape.issues;
    this.activeWoId = shape.activeWoId;
  }
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  active_wo_id?: string;
  issues?: ApiErrorIssue[];
}

export type AuthMeCapabilityDecision = 'allow' | 'deny' | 'unknown';

export interface AuthMeResponse {
  operator: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
  };
  primaryRole: UserRole;
  effectiveRoles: Array<{
    roleName: string;
    scopeType: string;
    scopeId: string | null;
  }>;
  authzVersion: number;
  catalogueVersion?: string;
  mode: 'shadow' | 'enforce' | 'partial';
  capabilities: Record<string, AuthMeCapabilityDecision>;
}
