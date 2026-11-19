export type ScopeLevel = 'ORGANIZATION' | 'SITE' | 'AREA' | 'LINE' | 'MACHINE' | 'DEVICE';

export interface IamInfo {
  mode: 'shadow' | 'enforce' | 'partial';
  authzVersion: number;
  effectiveInMode: string;
  enforcedDomains?: string[];
}

/**
 * Role IAM — bentuk kanonis GET /roles (§3.4): TIDAK ada `privilege_level`
 * maupun `policy_count` (E20 P20.3, X7); backend tidak mengembalikannya dan
 * panel dilarang mengisi nilai default.
 */
export interface IamRole {
  id: string;
  name: string;
  is_system: boolean;
  description: string;
  created_at: string;
}

/** Permission katalog — bentuk kanonis `{id, action, resourceType, description}` (§3.4). */
export interface IamPermission {
  id: string;
  action: string;
  resourceType: string;
  description: string;
}

export interface IamAssignment {
  id: string;
  operator_id: string;
  operator_name: string;
  role_id: string;
  role_name: string;
  scope_type: ScopeLevel;
  scope_id: string | null;
  created_at: string;
}

/**
 * Baris policy kanonis (§3.4, spec 042): camelCase, TANPA `reason` (reason
 * hanya tersimpan di audit IAM, bukan di baris policy). `roleName` adalah
 * nama role penampil; `subjectMatch` adalah pola subjek yang dievaluasi
 * (`*`, `role:<nama>`, atau `operator:<id>`).
 */
export interface IamPolicyRule {
  id: string;
  roleId: string;
  roleName: string;
  subjectMatch: string;
  permissionId?: string;
  action: string;
  resourceType: string;
  resourcePattern: string;
  effect: 'ALLOW' | 'DENY';
  abacCondition?: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
}

export interface IamAuditDecision {
  id: string;
  subject: string;
  decision: 'ALLOW' | 'DENY';
  mode: 'shadow' | 'enforce';
  action: string;
  resource: string;
  reason?: string;
  timestamp: string;
}

/** Filter GET /access-control/audit (§3.4) — dikirim sebagai query param. */
export interface IamAuditFilters {
  subject?: string;
  decision?: 'ALLOW' | 'DENY';
  mode?: 'shadow' | 'enforce';
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * Effective permissions subjek — bentuk kanonis
 * GET /subjects/:operatorId/effective-permissions (§3.4): `roles` adalah
 * satu-satunya nama field (tanpa alias `effectiveRoles`).
 */
export interface IamEffectivePermissions {
  operatorId: string;
  primaryRole: string;
  isActive: boolean;
  isProtected: boolean;
  authzVersion: number;
  effectiveInMode: string;
  assignments: IamAssignment[];
  roles: Array<{
    roleName: string;
    scopeType: ScopeLevel;
    scopeId: string | null;
  }>;
  permissions: Array<{
    action: string;
    resourceType: string;
    resourcePattern: string;
    effect: 'ALLOW' | 'DENY';
    sourceRole: string;
    abacCondition?: Record<string, unknown> | null;
  }>;
}
