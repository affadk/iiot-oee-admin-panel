/**
 * Mapper backend→lokal — IAM (role, permission, assignment, policy, audit, info).
 *
 * Dipisah dari mappers/system.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/system.ts.
 */
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../../../types/iam';
import { num, str, bool, iso, pick } from '../primitives';

export function mapIamRole(raw: unknown): IamRole {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.roleId, r.name)),
    name: str(pick(r.name)),
    // §3.4: `privilege_level` dan `policy_count` TIDAK dikembalikan backend —
    // jangan diisi nilai default (E20 P20.3, X7).
    is_system: bool(pick(r.is_system, r.isSystem, r.system), false),
    description: str(pick(r.description), ''),
    created_at: iso(pick(r.created_at, r.createdAt)),
  };
}

export function mapIamPermission(raw: unknown): IamPermission {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.permissionId)),
    action: str(pick(r.action)),
    resourceType: str(pick(r.resourceType, r.resource_type)),
    description: str(pick(r.description), ''),
  };
}

export function mapIamAssignment(raw: unknown): IamAssignment {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.assignmentId, `${pick(r.operator_id, r.operatorId)}:${pick(r.role_name, r.roleName)}`)),
    operator_id: str(pick(r.operator_id, r.operatorId)),
    operator_name: str(pick(r.operator_name, r.operatorName), ''),
    role_id: str(pick(r.role_id, r.roleId, r.role_name, r.roleName)),
    role_name: str(pick(r.role_name, r.roleName)),
    scope_type: (pick(r.scope_type, r.scopeType) as ScopeLevel) ?? 'ORGANIZATION',
    scope_id: (pick(r.scope_id, r.scopeId) as string | null) ?? null,
    created_at: iso(pick(r.created_at, r.createdAt)),
  };
}

export function mapIamPolicy(raw: unknown): IamPolicyRule {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Baris policy kanonis (§3.4): camelCase, TANPA `reason` (hanya di audit
  // IAM). `roleName` dari fieldnya sendiri — bukan diturunkan dari
  // `subjectMatch`; `subjectMatch` adalah pola (`*`, `role:<nama>`,
  // `operator:<id>`).
  const subjectMatch = str(pick(r.subjectMatch, r.subject_match), '');
  const roleName = str(pick(r.roleName, r.role_name));
  return {
    id: str(pick(r.id, r.policyId)),
    roleId: str(pick(r.roleId, r.role_id), ''),
    roleName: roleName || (subjectMatch.startsWith('role:') ? subjectMatch.slice(5) : ''),
    subjectMatch: subjectMatch || (roleName ? `role:${roleName}` : ''),
    permissionId: str(pick(r.permissionId, r.permission_id), undefined) || undefined,
    action: str(pick(r.action)),
    resourceType: str(pick(r.resourceType, r.resource_type)),
    resourcePattern: str(pick(r.resourcePattern, r.resource_pattern)),
    effect: (pick(r.effect, r.eft) as IamPolicyRule['effect']) ?? 'ALLOW',
    abacCondition: (pick(r.abacCondition, r.abac_condition) as IamPolicyRule['abacCondition']) ?? null,
    enabled: bool(pick(r.enabled, r.is_active, r.isActive), true),
    createdAt: iso(pick(r.createdAt, r.created_at)),
  };
}

export function mapIamAuditDecision(raw: unknown): IamAuditDecision {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.auditId, `${pick(r.timestamp)}-${pick(r.subject)}`)),
    subject: str(pick(r.subject, r.subject_id)),
    decision: (pick(r.decision) as IamAuditDecision['decision']) ?? 'DENY',
    mode: (pick(r.mode) as IamAuditDecision['mode']) ?? 'shadow',
    action: str(pick(r.action)),
    resource: str(pick(r.resource)),
    reason: str(pick(r.reason), undefined) || undefined,
    timestamp: iso(pick(r.timestamp, r.created_at, r.createdAt)),
  };
}

export function mapIamInfo(raw: unknown): IamInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  // E23 Batch 4 (FAT-205, N-36): spec live GET /access-control/info
  // mewajibkan {mode, effectiveInMode, enforcedDomains, catalogueVersion,
  // authzVersion}; `catalogueVersion` (string) dulu dibuang mapper, dan
  // `enforcedDomains` dulu opsional. `enforcedDomains` default [] bila
  // absen (toleransi terhadap respons lama); non-array → [].
  const domains = r.enforcedDomains ?? r.enforced_domains;
  return {
    mode: (pick(r.mode, 'shadow') as IamInfo['mode']),
    authzVersion: num(pick(r.authzVersion, r.authz_version), 0),
    effectiveInMode: str(pick(r.effectiveInMode, r.effective_in_mode), ''),
    catalogueVersion: str(pick(r.catalogueVersion, r.catalogue_version), ''),
    enforcedDomains: Array.isArray(domains) ? domains.filter((d): d is string => typeof d === 'string') : [],
  };
}

export function mapIamSubjectEffectivePermissions(raw: unknown, operatorId: string): IamEffectivePermissions {
  const r = (raw ?? {}) as Record<string, unknown>;
  // E23 Batch 1 (FAT-176, N-7): spec live — `roles` adalah string[]
  // (mis. ["ADMIN","OPERATOR"]); objek {roleName, roleId, scopeType,
  // scopeId} hidup di `assignments[]`, bukan di `roles[]`. Bentuk lama
  // membaca tiap elemen `roles` sebagai objek → `roleName` ''.
  // Toleransi: elemen objek lama tetap dibaca `roleName`-nya.
  const roles = ((r.roles ?? []) as unknown[]).map((x) =>
    typeof x === 'string' ? x : str(pick((x as Record<string, unknown>).roleName, (x as Record<string, unknown>).role_name)),
  ).filter((name) => name !== '');
  const assignments = ((r.assignments ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      id: str(pick(e.id, e.assignmentId, `${pick(e.operatorId, e.operator_id)}:${pick(e.roleName, e.role_name)}`)),
      operator_id: str(pick(e.operatorId, e.operator_id)),
      operator_name: str(pick(e.operatorName, e.operator_name), ''),
      role_id: str(pick(e.roleId, e.role_id, e.roleName, e.role_name)),
      role_name: str(pick(e.roleName, e.role_name)),
      scope_type: (pick(e.scopeType, e.scope_type) as ScopeLevel) ?? 'ORGANIZATION',
      scope_id: (pick(e.scopeId, e.scope_id) as string | null) ?? null,
      created_at: iso(pick(e.createdAt, e.created_at)),
    };
  });
  const perms = ((r.permissions ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      action: str(pick(e.action)),
      resourceType: str(pick(e.resourceType, e.resource_type)),
      resourcePattern: str(pick(e.resourcePattern, e.resource_pattern)),
      effect: (pick(e.effect, 'ALLOW') as 'ALLOW' | 'DENY'),
      // E23 Batch 1 (FAT-176, N-7): spec live — izin membawa `roleName`
      // sebagai sumber peran (bukan `sourceRole`).
      sourceRole: str(pick(e.roleName, e.role_name, e.sourceRole, e.source_role)),
      abacCondition: (pick(e.abacCondition, e.abac_condition) as Record<string, unknown> | null) ?? null,
    };
  });
  return {
    operatorId: str(pick(r.operatorId, r.operator_id, operatorId)),
    primaryRole: str(pick(r.primaryRole, r.primary_role)),
    isActive: bool(pick(r.isActive, r.is_active), true),
    isProtected: bool(pick(r.isProtected, r.is_protected), false),
    authzVersion: num(pick(r.authzVersion, r.authz_version), 0),
    effectiveInMode: str(pick(r.effectiveInMode, r.effective_in_mode), ''),
    assignments,
    roles,
    permissions: perms,
  };
}
