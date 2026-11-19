/**
 * Mapper backend→lokal — domain system.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { num, str, bool, iso, pick, splitList } from '../primitives';
import { mapReject } from './monitoring';
import { mapBrokerConfigLastOperation } from './mqttConfig';
import { AuthMeResponse, AuthMeCapabilityEntry } from '../../../../types/auth';
import { RejectParetoItem } from '../../../../types/analytics';
import { MqttClient, MqttRole, MqttAcl, MqttGroup, MqttDynsecStatus, BrokerOverviewInfo, BrokerOperation, BrokerOperationStep } from '../../../../types/mqtt';
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../../../types/iam';

// E23 Batch 1: mapper konfigurasi broker dipindah ke ./mqttConfig (R9.2) —
// system.ts menyentuh hard cap 600 baris. Re-export agar import lama
// (`./system`, barrel `./mappers`) tetap jalan.
export { mapBrokerConfigVersion, mapBrokerConfigDiff, mapBrokerConfigStatus, mapBrokerConfigLastOperation } from './mqttConfig';

export function mapMqttClient(raw: unknown): MqttClient {
  const r = (raw ?? {}) as Record<string, unknown>;
  const roles = (pick(r.roles) as unknown[]) ?? [];
  const groups = (pick(r.groups) as unknown[]) ?? [];
  return {
    username: str(pick(r.username)),
    clientid: str(pick(r.clientid, r.clientId), undefined) || undefined,
    textname: str(pick(r.textname), undefined) || undefined,
    textdescription: str(pick(r.textdescription), undefined) || undefined,
    // B35 (diperbaiki E15, K-06): `enabled` bila ada dipakai langsung;
    // bila hanya `disabled` yang ada, turunkan darinya; bila tidak ada
    // keduanya, default aktif. Bentuk lama membalik {enabled:false}.
    enabled:
      pick(r.enabled) !== undefined
        ? bool(r.enabled, true)
        : pick(r.disabled) !== undefined
          ? !bool(r.disabled, false)
          : true,
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
export function mapBrokerOperation(raw: unknown): BrokerOperation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const steps = ((pick(r.steps) as unknown[]) ?? []).map((s) => {
    const st = (s ?? {}) as Record<string, unknown>;
    return {
      step: str(pick(st.step, st.name)),
      status: (pick(st.status) as BrokerOperationStep['status']) ?? 'PENDING',
      message: str(pick(st.message, st.detail), undefined) || undefined,
      startedAt: (pick(st.startedAt, st.started_at) as string | null) ?? null,
      finishedAt: (pick(st.finishedAt, st.finished_at) as string | null) ?? null,
      detail: (pick(st.detail) as string | undefined) ?? undefined,
    };
  });
  // E23 Batch 3 (FAT-200, N-31): spec live `type` = APPLY/ROLLBACK/
  // DISCARD|null — dipetakan apa adanya (bukan lagi dipaksa 'RELOAD').
  // Nilai legacy `operation_type` (NO_OPERATION/RELOAD/RESTART, STAGE)
  // hanya fallback bila field `type` tak ada. `type: null` eksplisit
  // (aksi RECOVERY) tetap null — `pick` membuang null, jadi dicek
  // langsung dari field mentah.
  const specType = pick(r.type) as string | undefined;
  const rawType = pick(r.operation_type, r.operationType) as string | undefined;
  const action = pick(r.action) as string | undefined;
  const type: BrokerOperation['type'] =
    r.type === null || action === 'RECOVERY'
      ? null
      : specType === 'APPLY' || specType === 'ROLLBACK' || specType === 'DISCARD'
        ? specType
        : rawType === 'NO_OPERATION' || rawType === 'RELOAD' || rawType === 'RESTART'
          ? rawType
          : rawType === 'STAGE'
            ? 'NO_OPERATION'
            : specType === 'NO_OPERATION' || specType === 'RELOAD' || specType === 'RESTART'
              ? specType
              : 'RELOAD';
  // E23 Batch 3 (FAT-200, N-31): field spec yang dulu dibuang —
  // domainStatus/domainAction/phase/actor/startedAt/finishedAt/error/
  // result. Spec TIDAK punya `timestamp`/`created_at` — sumber kanonis
  // adalah `startedAt`; absen → '' (JANGAN `iso()` → epoch 1970).
  // `completed_at` ← `finishedAt`.
  const startedAt = (pick(r.startedAt, r.started_at) as string | null) ?? null;
  const finishedAt = (pick(r.finishedAt, r.finished_at) as string | null) ?? null;
  const errorRaw = (pick(r.error) as Record<string, unknown> | null) ?? null;
  const resultRaw = (pick(r.result) as Record<string, unknown> | null) ?? null;
  const domainStatus = pick(r.domainStatus, r.domain_status) as BrokerOperation['domainStatus'];
  const domainAction = pick(r.domainAction, r.domain_action) as BrokerOperation['domainAction'];
  return {
    operation_id: str(pick(r.operation_id, r.operationId, r.id)),
    type,
    version_id: str(pick(r.version_id, r.versionId)),
    status: (pick(r.status) as BrokerOperation['status']) ?? 'PENDING',
    reason: str(pick(r.reason), undefined) || undefined,
    steps,
    timestamp: startedAt ?? str(pick(r.timestamp, r.created_at, r.createdAt), ''),
    completed_at: finishedAt ?? (pick(r.completed_at, r.completedAt) as string | null) ?? null,
    domainStatus:
      domainStatus === 'QUEUED' || domainStatus === 'RUNNING' || domainStatus === 'SUCCEEDED' || domainStatus === 'FAILED' || domainStatus === 'ROLLED_BACK' || domainStatus === 'INTERRUPTED'
        ? domainStatus
        : null,
    domainAction:
      domainAction === 'APPLY' || domainAction === 'ROLLBACK' || domainAction === 'RECOVERY' ? domainAction : null,
    phase: (pick(r.phase) as string | null) ?? null,
    actorId: (pick(r.actorId, r.actor_id) as string | null) ?? null,
    actorName: (pick(r.actorName, r.actor_name) as string | null) ?? null,
    startedAt,
    finishedAt,
    error:
      errorRaw && typeof errorRaw.code === 'string'
        ? { code: errorRaw.code, message: str(pick(errorRaw.message)) }
        : null,
    result: resultRaw
      ? {
          previousVersionId: (pick(resultRaw.previousVersionId, resultRaw.previous_version_id) as string | null) ?? null,
          appliedVersionId: (pick(resultRaw.appliedVersionId, resultRaw.applied_version_id) as string | null) ?? null,
          rollbackAttempted: bool(pick(resultRaw.rollbackAttempted, resultRaw.rollback_attempted), false),
          rollbackSucceeded: bool(pick(resultRaw.rollbackSucceeded, resultRaw.rollback_succeeded), false),
        }
      : null,
  };
}

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

export function mapBrokerOverview(raw: unknown): BrokerOverviewInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ds = (r.dynamicSecurity ?? r.dynamic_security ?? {}) as Record<string, unknown>;
  // B44 (E15, K-07): API §3.3a — `configuration: null` berarti plugin
  // tidak aktif; tampilkan UNAVAILABLE, bukan IN_SYNC.
  const cfgRaw = r.configuration as Record<string, unknown> | null | undefined;
  const cfg = (cfgRaw ?? {}) as Record<string, unknown>;
  // E20 P20.5 (FAT-157): bentuk §3.3a — count `null` dipertahankan
  // (bukan 0, FR-035-51); petakan `available`/`lastError`/`measuredAt`/
  // `lastOperation`.
  // E23 Batch 3 (FAT-197, N-28): spec live — `status` enum
  // READY/CONNECTING/DISCONNECTED (bukan hardcode 'READY'); varian
  // `available=false` membawa `reason` (tanpa `status` → fallback
  // 'DISCONNECTED'); `lastOperation` berupa OBJEK (bentuk
  // `BrokerConfigLastOperation`)|null — bukan string (dipetakan lewat
  // `mapBrokerConfigLastOperation` yang sama dengan status config).
  const countOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const statusRaw = pick(ds.status) as string | undefined;
  const status: BrokerOverviewInfo['dynamicSecurity']['status'] =
    statusRaw === 'READY' || statusRaw === 'CONNECTING' || statusRaw === 'DISCONNECTED' ? statusRaw : 'DISCONNECTED';
  return {
    dynamicSecurity: {
      available: bool(pick(ds.available), false),
      enabled: bool(pick(ds.enabled), false),
      status,
      reason: strOrNull(pick(ds.reason)),
      clientsCount: countOrNull(pick(ds.clientsCount, ds.clients_count)),
      rolesCount: countOrNull(pick(ds.rolesCount, ds.roles_count)),
      groupsCount: countOrNull(pick(ds.groupsCount, ds.groups_count)),
      lastError: strOrNull(pick(ds.lastError, ds.last_error)),
      measuredAt: strOrNull(pick(ds.measuredAt, ds.measured_at)),
    },
    configuration: {
      status: (cfgRaw == null ? 'UNAVAILABLE' : pick(cfg.status, 'IN_SYNC')) as BrokerOverviewInfo['configuration']['status'],
      activeVersionId: (pick(cfg.activeVersionId, cfg.active_version) as string | null) ?? null,
      lastAppliedAt: (pick(cfg.lastAppliedAt, cfg.last_applied_at) as string | null) ?? null,
      mutationLocked: bool(pick(cfg.mutationLocked, cfg.mutation_locked), false),
      lastOperation: mapBrokerConfigLastOperation(pick(cfg.lastOperation, cfg.last_operation) ?? null),
      measuredAt: strOrNull(pick(cfg.measuredAt, cfg.measured_at)),
    },
  };
}

export function mapMqttDynsecStatus(raw: unknown): MqttDynsecStatus {
  // E23 Batch 4 (FAT-203, N-33): spec live GET /mqtt/dynamic-security/status
  // = {connected, subscribed, connecting, pluginReady, brokerUrl,
  // adminUsername, lastError, lastConnectedAt}. Bentuk lama panel
  // (enabled/status/clients_count/roles_count/groups_count) tak satu pun
  // ada di spec — mapper lama selalu menghasilkan {enabled:false,
  // status:'DISCONNECTED', 0,0,0}. `lastError`/`lastConnectedAt` nullable.
  const r = (raw ?? {}) as Record<string, unknown>;
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    connected: bool(pick(r.connected), false),
    subscribed: bool(pick(r.subscribed), false),
    connecting: bool(pick(r.connecting), false),
    pluginReady: bool(pick(r.pluginReady, r.plugin_ready), false),
    brokerUrl: str(pick(r.brokerUrl, r.broker_url), ''),
    adminUsername: str(pick(r.adminUsername, r.admin_username), ''),
    lastError: strOrNull(pick(r.lastError, r.last_error)),
    lastConnectedAt: strOrNull(pick(r.lastConnectedAt, r.last_connected_at)),
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

/**
 * GET /auth/me — toleran terhadap tiga bentuk dokumen (D-2):
 * - flat §L: `{operator, authz}`
 * - nested §3.4: `{access:{mode,channel,mutations_allowed}, operator, authz}`
 * - ringkas §6B: `{capabilities, mode}` (tanpa operator/authz)
 * `primaryRole` tanpa default 'OPERATOR' (absen = undefined → UNASSIGNED).
 * Capability array memakai `decision` (dokumen); `state` diterima sebagai alias.
 */
export function mapAuthMe(raw: unknown): AuthMeResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const authz = (r.authz ?? {}) as Record<string, unknown>;
  const operator = (r.operator ?? {}) as Record<string, unknown>;
  const access = (r.access ?? {}) as Record<string, unknown>;
  const flatCaps = (r.capabilities ?? authz.capabilities ?? {}) as unknown;
  const capabilities: Record<string, 'allow' | 'deny' | 'unknown'> = {};
  const capabilityDetails: Record<string, AuthMeCapabilityEntry> = {};
  if (Array.isArray(flatCaps)) {
    for (const c of flatCaps as Array<Record<string, unknown>>) {
      const key = str(c.key);
      const decision = str(pick(c.decision, c.state), 'unknown');
      if (!key) continue;
      capabilities[key] = decision === 'allow' || decision === 'deny' ? decision : 'unknown';
      capabilityDetails[key] = {
        key,
        domain: str(pick(c.domain), undefined) || undefined,
        surface: str(pick(c.surface), undefined) || undefined,
        decision: capabilities[key],
        mode: str(pick(c.mode), undefined) || undefined,
        reason: str(pick(c.reason), undefined) || undefined,
      };
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
  // §L/§3.4 memakai `primaryRole`, bukan `role`, pada operator auth/me.
  const primaryRole = str(pick(operator.primaryRole, r.primaryRole, authz.primaryRole), undefined) || undefined;
  const attributes =
    authz.attributes && typeof authz.attributes === 'object'
      ? (authz.attributes as Record<string, unknown>)
      : undefined;
  return {
    operator: {
      operator_id: str(pick(operator.id, operator.operator_id)),
      name: str(pick(operator.username, operator.name)),
      role: primaryRole ?? 'UNASSIGNED',
      line_id: str(pick(operator.lineId, operator.line_id), undefined) || undefined,
      isActive: pick(operator.isActive, operator.is_active) as boolean | undefined,
      isProtected: pick(operator.isProtected, operator.is_protected) as boolean | undefined,
      mustChangePassword: pick(operator.mustChangePassword, operator.must_change_password) as boolean | undefined,
    },
    primaryRole,
    effectiveRoles,
    authzVersion: num(pick(authz.authzVersion, r.authzVersion), 0),
    catalogueVersion: str(pick(authz.catalogueVersion, r.catalogueVersion), undefined) || undefined,
    mode: (pick(authz.mode, r.mode, access.mode) as AuthMeResponse['mode']) ?? 'shadow',
    capabilities,
    capabilityDetails: Object.keys(capabilityDetails).length > 0 ? capabilityDetails : undefined,
    attributes,
    access:
      Object.keys(access).length > 0
        ? {
            mode: str(pick(access.mode), undefined) || undefined,
            channel: str(pick(access.channel), undefined) || undefined,
            mutations_allowed: pick(access.mutations_allowed, access.mutationsAllowed) as boolean | undefined,
          }
        : undefined,
  };
}
