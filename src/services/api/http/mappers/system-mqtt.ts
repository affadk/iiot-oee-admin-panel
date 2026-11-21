/**
 * Mapper backend→lokal — MQTT Dynamic Security + broker overview.
 *
 * Dipisah dari mappers/system.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/system.ts.
 */
import { MqttClient, MqttRole, MqttAcl, MqttGroup, MqttDynsecStatus, BrokerOverviewInfo, BrokerOperation, BrokerOperationStep } from '../../../../types/mqtt';
import { mapBrokerConfigLastOperation } from './mqttConfig';
import { num, str, bool, pick } from '../primitives';

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
