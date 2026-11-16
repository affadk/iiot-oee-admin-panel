/**
 * Mapper backend→lokal — domain system.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { num, str, bool, iso, pick, splitList } from '../primitives';
import { mapReject } from './monitoring';
import { AuthMeResponse, UserRole } from '../../../../types/auth';
import { RejectParetoItem } from '../../../../types/analytics';
import { MqttClient, MqttRole, MqttAcl, MqttGroup, BrokerOverviewInfo, BrokerConfigSchema, BrokerConfigVersion, BrokerOperation, BrokerOperationStep } from '../../../../types/mqtt';
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../../../types/iam';

export function mapMqttClient(raw: unknown): MqttClient {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = (pick(r.roles) as unknown[]) ?? [];
  const groups = (pick(r.groups) as unknown[]) ?? [];
  return {
    username: str(pick(r.username)),
    clientid: str(pick(r.clientid, r.clientId), undefined) || undefined,
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    enabled: bool(pick(r.enabled, r.disabled) === undefined ? true : !bool(r.disabled, false), true),
    roles: roles.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).rolename))),
    groups: groups.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).groupname))),
    created_at: str(pick(r.created_at), undefined) || undefined,
    last_seen: str(pick(r.last_seen), undefined) || undefined,
  };
}

export function mapMqttRole(raw: unknown): MqttRole {
  const r = (raw ?? {}) as Record<string, unknown>;
  const acls = ((pick(r.acls) as unknown[]) ?? []).map((a) => {
    const ac = (a ?? {}) as Record<string, unknown>;
    return {
      acltype: str(pick(ac.acltype)) as MqttAcl['acltype'],
      topic: str(pick(ac.topic)),
      priority: num(pick(ac.priority), 0) || undefined,
      allow: bool(pick(ac.allow), true),
    } as MqttAcl;
  });
  return {
    rolename: str(pick(r.rolename)),
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    acls,
  };
}

export function mapMqttGroup(raw: unknown): MqttGroup {
  const r = (raw ?? {}) as Record<string, unknown>;
  const clients = (pick(r.clients) as unknown[]) ?? [];
  const roles = (pick(r.roles) as unknown[]) ?? [];
  return {
    groupname: str(pick(r.groupname)),
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    clients: clients.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).username))),
    roles: roles.map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown>).rolename))),
  };
}

export function mapBrokerConfigVersion(raw: unknown): BrokerConfigVersion {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    version_id: str(pick(r.version_id, r.versionId, r.id)),
    parent_version_id: (pick(r.parent_version_id, r.parentVersionId) as string | null) ?? null,
    applied_at: iso(pick(r.applied_at, r.appliedAt, r.created_at, r.createdAt)),
    applied_by: str(pick(r.applied_by, r.appliedBy), 'system'),
    summary: str(pick(r.summary, r.reason, r.comment), ''),
    operation_type: (pick(r.operation_type, r.operationType) as BrokerConfigVersion['operation_type']) ?? 'NO_OPERATION',
    status: (pick(r.status) as BrokerConfigVersion['status']) ?? 'STAGED',
    config: (pick(r.config) as BrokerConfigSchema) ?? ({} as BrokerConfigSchema),
  };
}

export function mapBrokerOperation(raw: unknown): BrokerOperation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const steps = ((pick(r.steps) as unknown[]) ?? []).map((s) => {
    const st = (s ?? {}) as Record<string, unknown>;
    return {
      step: str(pick(st.step, st.name)),
      status: (pick(st.status) as BrokerOperationStep['status']) ?? 'PENDING',
      message: str(pick(st.message), undefined) || undefined,
    };
  });
  return {
    operation_id: str(pick(r.operation_id, r.operationId, r.id)),
    type: (pick(r.type, r.operation_type) as BrokerOperation['type']) ?? 'APPLY',
    version_id: str(pick(r.version_id, r.versionId)),
    status: (pick(r.status) as BrokerOperation['status']) ?? 'PENDING',
    reason: str(pick(r.reason), undefined) || undefined,
    steps,
    timestamp: iso(pick(r.timestamp, r.created_at, r.createdAt)),
    completed_at: (pick(r.completed_at, r.completedAt) as string | null) ?? null,
  };
}

export function mapIamRole(raw: unknown): IamRole {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.roleId, r.name)),
    name: str(pick(r.name)),
    // Hierarki level statis dihapus backend (Guide §4.6g / FR-032-20):
    // field dipertahankan untuk kompatibilitas tipe lokal, bukan otorisasi.
    privilege_level: num(pick(r.privilege_level, r.privilegeLevel), 1),
    is_system: bool(pick(r.is_system, r.isSystem, r.system), false),
    description: str(pick(r.description), ''),
    created_at: iso(pick(r.created_at, r.createdAt)),
    policy_count: num(pick(r.policy_count, r.policyCount), 0) || undefined,
  };
}

export function mapIamPermission(raw: unknown): IamPermission {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(pick(r.id, r.permissionId)),
    action: str(pick(r.action)),
    resource_type: str(pick(r.resource_type, r.resourceType)),
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
  return {
    id: str(pick(r.id, r.policyId)),
    role: str(pick(r.role, r.subject_match, r.subjectMatch, r.roleName)),
    subject_match: str(pick(r.subject_match, r.subjectMatch), undefined) || undefined,
    role_id: str(pick(r.role_id, r.roleId), undefined) || undefined,
    permission_id: str(pick(r.permission_id, r.permissionId), undefined) || undefined,
    action: str(pick(r.action)),
    resource_pattern: str(pick(r.resource_pattern, r.resourcePattern)),
    eft: (pick(r.eft, r.effect) as IamPolicyRule['eft']) ?? 'ALLOW',
    abac_condition: (pick(r.abac_condition, r.abacCondition) as IamPolicyRule['abac_condition']) ?? null,
    is_active: bool(pick(r.is_active, r.isActive, r.enabled), true),
    reason: str(pick(r.reason), undefined) || undefined,
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

export function mapBrokerOverview(raw: unknown): BrokerOverviewInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ds = (r.dynamicSecurity ?? r.dynamic_security ?? {}) as Record<string, unknown>;
  const cfg = (r.configuration ?? {}) as Record<string, unknown>;
  return {
    dynamicSecurity: {
      enabled: bool(pick(ds.enabled), false),
      status: (pick(ds.status, 'DISCONNECTED') as 'CONNECTED' | 'DISCONNECTED'),
      clientsCount: num(pick(ds.clientsCount, ds.clients_count), 0),
      rolesCount: num(pick(ds.rolesCount, ds.roles_count), 0),
      groupsCount: num(pick(ds.groupsCount, ds.groups_count), 0),
    },
    configuration: {
      status: (pick(cfg.status, 'IN_SYNC') as BrokerOverviewInfo['configuration']['status']),
      activeVersionId: (pick(cfg.activeVersionId, cfg.active_version) as string | null) ?? null,
      lastAppliedAt: (pick(cfg.lastAppliedAt, cfg.last_applied_at) as string | null) ?? null,
      mutationLocked: bool(pick(cfg.mutationLocked, cfg.mutation_locked), false),
    },
  };
}

export function mapMqttDynsecStatus(raw: unknown): {
  enabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED';
  clients_count: number;
  roles_count: number;
  groups_count: number;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(pick(r.enabled), false),
    status: (pick(r.status, 'DISCONNECTED') as 'CONNECTED' | 'DISCONNECTED'),
    clients_count: num(pick(r.clients_count, r.clientsCount), 0),
    roles_count: num(pick(r.roles_count, r.rolesCount), 0),
    groups_count: num(pick(r.groups_count, r.groupsCount), 0),
  };
}

export function mapBrokerConfigStatus(raw: unknown): {
  active_version: string;
  sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
  last_applied_at: string;
  mutation_locked: boolean;
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    active_version: str(pick(r.active_version, r.activeVersionId, r.activeVersion), ''),
    sync_state: (pick(r.sync_state, r.syncState, r.status, 'IN_SYNC') as 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED'),
    last_applied_at: iso(pick(r.last_applied_at, r.lastAppliedAt)),
    mutation_locked: bool(pick(r.mutation_locked, r.mutationLocked), false),
  };
}

export function mapIamInfo(raw: unknown): IamInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    mode: (pick(r.mode, 'shadow') as IamInfo['mode']),
    authzVersion: num(pick(r.authzVersion, r.authz_version), 0),
    effectiveInMode: str(pick(r.effectiveInMode, r.effective_in_mode), ''),
    enforcedDomains: (r.enforcedDomains ?? r.enforced_domains) as string[] | undefined,
  };
}

export function mapIamSubjectEffectivePermissions(raw: unknown, operatorId: string): IamEffectivePermissions {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = ((r.effectiveRoles ?? r.effective_roles ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      roleName: str(pick(e.roleName, e.role_name)),
      scopeType: (pick(e.scopeType, e.scope_type, 'ORGANIZATION') as ScopeLevel),
      scopeId: (pick(e.scopeId, e.scope_id) as string | null) ?? null,
    };
  });
  const perms = ((r.permissions ?? []) as unknown[]).map((x) => {
    const e = (x ?? {}) as Record<string, unknown>;
    return {
      action: str(pick(e.action)),
      resourceType: str(pick(e.resourceType, e.resource_type)),
      resourcePattern: str(pick(e.resourcePattern, e.resource_pattern)),
      effect: (pick(e.effect, 'ALLOW') as 'ALLOW' | 'DENY'),
      sourceRole: str(pick(e.sourceRole, e.source_role)),
      abacCondition: (pick(e.abacCondition, e.abac_condition) as Record<string, unknown> | null) ?? null,
    };
  });
  return {
    operatorId: str(pick(r.operatorId, r.operator_id, operatorId)),
    primaryRole: str(pick(r.primaryRole, r.primary_role)),
    effectiveRoles: roles,
    permissions: perms,
  };
}

export function paretoFromRows(raw: unknown): RejectParetoItem[] {
  const { items } = splitList(raw);
  const total = items.reduce<number>((sum, it) => sum + num((it as Record<string, unknown>).count, 0), 0);
  const runningTotal = { total, cumulative: 0 };
  return items.map((it) => {
    const rec = it as Record<string, unknown>;
    const enriched = {
      ...rec,
      pct: rec.pct ?? rec.percentage ?? (total > 0 ? (num(rec.count, 0) / total) * 100 : 0),
    };
    return mapReject(enriched, runningTotal);
  });
}

export function mapAuthMe(raw: unknown): AuthMeResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Backend punya dua bentuk (API doc §L vs Guide §4.9); terima keduanya.
  const authz = (r.authz ?? {}) as Record<string, unknown>;
  const operator = (r.operator ?? {}) as Record<string, unknown>;
  const flatCaps = (r.capabilities ?? authz.capabilities ?? {}) as unknown;
  const capabilities: Record<string, 'allow' | 'deny' | 'unknown'> = {};
  if (Array.isArray(flatCaps)) {
    for (const c of flatCaps as Array<Record<string, unknown>>) {
      const key = str(c.key);
      const decision = str(pick(c.decision, c.state), 'unknown');
      if (key) capabilities[key] = decision === 'allow' || decision === 'deny' ? decision : 'unknown';
    }
  } else if (flatCaps && typeof flatCaps === 'object') {
    for (const [k, v] of Object.entries(flatCaps as Record<string, unknown>)) {
      capabilities[k] = v === 'allow' || v === 'deny' ? v : 'unknown';
    }
  }
  const effectiveRolesRaw = (pick(authz.effectiveRoles, r.effectiveRoles) as unknown[]) ?? [];
  const effectiveRoles = effectiveRolesRaw.map((e) => {
    if (typeof e === 'string') return { roleName: e, scopeType: 'ORGANIZATION', scopeId: null };
    const o = (e ?? {}) as Record<string, unknown>;
    return {
      roleName: str(pick(o.roleName, o.role_name, o.role)),
      scopeType: str(pick(o.scopeType, o.scope_type), 'ORGANIZATION'),
      scopeId: (pick(o.scopeId, o.scope_id) as string | null) ?? null,
    };
  });
  const primaryRole = str(pick(r.primaryRole, authz.primaryRole, operator.role), 'OPERATOR') as UserRole;
  return {
    operator: {
      operator_id: str(pick(operator.id, operator.operator_id)),
      name: str(pick(operator.username, operator.name)),
      role: (pick(operator.role) as UserRole) ?? primaryRole,
      line_id: str(pick(operator.lineId, operator.line_id), undefined) || undefined,
    },
    primaryRole,
    effectiveRoles: effectiveRoles.length > 0 ? effectiveRoles : [{ roleName: primaryRole, scopeType: 'ORGANIZATION', scopeId: null }],
    authzVersion: num(pick(authz.authzVersion, r.authzVersion), 0),
    catalogueVersion: str(pick(authz.catalogueVersion, r.catalogueVersion), undefined) || undefined,
    mode: (pick(authz.mode, r.mode) as AuthMeResponse['mode']) ?? 'shadow',
    capabilities,
  };
}
