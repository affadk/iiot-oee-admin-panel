/**
 * Mapper backend→lokal — domain mqttConfig (versi + status + diff + skema
 * + raw + backup).
 *
 * Dipisah dari mappers/system.ts pada E23 Batch 1 (kontrak
 * docs/DIRECTORY_STRUCTURE.md, pola R9.2): system.ts menyentuh hard cap
 * 600 baris. Satu file = satu domain. Barrel penggabung ada di file induknya.
 *
 * FAT-285 (E32.4): `mapBrokerConfigSchema`, `mapBrokerConfigRawResult`,
 * dan `mapBrokerBackup` dipindah verbatim dari `http/mqttConfig.ts`
 * (R10 — pemetaan tinggal di `mappers/`, bukan inline di method HTTP).
 */
import { num, str, bool, iso, pick } from '../primitives';
import { BrokerConfigSchema, BrokerConfigVersion, BrokerConfigStatus, BrokerConfigValidation, BrokerConfigImpact, BrokerConfigDiff, BrokerConfigLastOperation, BrokerBackup, BrokerConfigRawResult } from '../../../../types/mqtt';


export function mapBrokerConfigVersion(raw: unknown): BrokerConfigVersion {
  const r = (raw ?? {}) as Record<string, unknown>;
  // E20 P20.5 (FAT-157): status versi panel hanya STAGED/ACTIVE/ROLLED_BACK
  // (§3.3b); nilai domain asli (mis. 'APPLIED' dari server lama) masuk
  // `domainStatus`, bukan `status`.
  const rawStatus = pick(r.status) as string | undefined;
  const panelStatus: BrokerConfigVersion['status'] =
    rawStatus === 'STAGED' || rawStatus === 'ACTIVE' || rawStatus === 'ROLLED_BACK' ? rawStatus : 'STAGED';
  // E23 Batch 1 (FAT-181, N-12): respons stage 201 / GET versi menyertakan
  // `validation`/`impact`/`diff` (spec live) — simpan, jangan dibuang.
  const validation = mapBrokerConfigValidation(r.validation);
  const impact = mapBrokerConfigImpact(r.impact);
  const diff = mapBrokerConfigDiff(r.diff);
  return {
    version_id: str(pick(r.version_id, r.versionId, r.id)),
    parent_version_id: (pick(r.parent_version_id, r.parentVersionId) as string | null) ?? null,
    applied_at: iso(pick(r.applied_at, r.appliedAt, r.created_at, r.createdAt)),
    applied_by: str(pick(r.applied_by, r.appliedBy), 'system'),
    summary: str(pick(r.summary, r.reason, r.comment), ''),
    operation_type: (pick(r.operation_type, r.operationType) as BrokerConfigVersion['operation_type']) ?? 'NO_OPERATION',
    status: panelStatus,
    domainStatus: (pick(r.domainStatus, r.domain_status) as string | null) ?? (rawStatus !== panelStatus ? rawStatus ?? null : null),
    config: (pick(r.config) as BrokerConfigSchema) ?? ({} as BrokerConfigSchema),
    ...(validation ? { validation } : {}),
    ...(impact ? { impact } : {}),
    ...(diff ? { diff } : {}),
  };
}

function mapBrokerConfigValidation(raw: unknown): BrokerConfigValidation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  const status = pick(v.status) as BrokerConfigValidation['status'] | undefined;
  if (status !== 'passed' && status !== 'failed' && status !== 'skipped') return undefined;
  const isolatedRaw = (v.isolated ?? null) as Record<string, unknown> | null;
  const isolatedStatus = isolatedRaw ? (pick(isolatedRaw.status) as 'passed' | 'failed' | 'skipped' | undefined) : undefined;
  return {
    status,
    checkedAt: (pick(v.checkedAt, v.checked_at) as string | undefined) ?? undefined,
    issues: Array.isArray(v.issues)
      ? (v.issues as unknown[]).map((i) => {
          const it = (i ?? {}) as Record<string, unknown>;
          return {
            field: str(pick(it.field)),
            message: str(pick(it.message)),
            ...(pick(it.severity) === 'error' || pick(it.severity) === 'warning'
              ? { severity: pick(it.severity) as 'error' | 'warning' }
              : {}),
            ...(typeof it.code === 'string' ? { code: it.code } : {}),
          };
        })
      : [],
    ...(isolatedRaw && isolatedStatus
      ? {
          isolated: {
            status: isolatedStatus,
            message: (pick(isolatedRaw.message) as string | null) ?? null,
            exitCode: (pick(isolatedRaw.exitCode, isolatedRaw.exit_code) as number | null) ?? null,
            durationMs: (pick(isolatedRaw.durationMs, isolatedRaw.duration_ms) as number | undefined) ?? undefined,
            output: (pick(isolatedRaw.output) as string | undefined) ?? undefined,
          },
        }
      : {}),
  };
}

function mapBrokerConfigImpact(raw: unknown): BrokerConfigImpact | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  const action = pick(v.action) as BrokerConfigImpact['action'] | undefined;
  if (action !== 'none' && action !== 'reload' && action !== 'restart') return undefined;
  return {
    action,
    reasons: Array.isArray(v.reasons) ? (v.reasons as unknown[]).map((x) => String(x)) : [],
    changes: Array.isArray(v.changes)
      ? (v.changes as unknown[]).map((c) => {
          const it = (c ?? {}) as Record<string, unknown>;
          const op = pick(it.operation) as 'add' | 'remove' | 'change' | undefined;
          return {
            scope: str(pick(it.scope)),
            key: str(pick(it.key)),
            operation: op === 'add' || op === 'remove' || op === 'change' ? op : 'change',
          };
        })
      : [],
  };
}

export function mapBrokerConfigDiff(raw: unknown): BrokerConfigDiff | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  if (!Array.isArray(v.lines)) return undefined;
  return {
    baseVersionId: (pick(v.baseVersionId, v.base_version_id) as string | null) ?? null,
    versionId: (pick(v.versionId, v.version_id) as string | null) ?? null,
    baseChecksum: (pick(v.baseChecksum, v.base_checksum) as string | null) ?? null,
    checksum: str(pick(v.checksum)),
    truncated: bool(pick(v.truncated), false),
    lines: (v.lines as unknown[]).map((l) => {
      const it = (l ?? {}) as Record<string, unknown>;
      const type = pick(it.type) as BrokerConfigDiff['lines'][number]['type'] | undefined;
      return {
        type: type === 'add' || type === 'remove' ? type : 'context',
        oldLine: (pick(it.oldLine, it.old_line) as number | null) ?? null,
        newLine: (pick(it.newLine, it.new_line) as number | null) ?? null,
        text: str(pick(it.text)),
      };
    }),
  };
}



/**
 * E23 Batch 3 (FAT-197/FAT-200, N-28/N-31): pemetaan bersama objek
 * `lastOperation` spec live (dipakai `GET /mqtt/configuration/status`
 * DAN `GET /mqtt/overview` — bentuk yang sama). Objek tanpa
 * `operation_id` string → null (bukan objek kosong).
 */
export function mapBrokerConfigLastOperation(raw: unknown): BrokerConfigLastOperation | null {
  const lastOp = (raw ?? null) as Record<string, unknown> | null;
  if (!lastOp || typeof lastOp.operation_id !== 'string') {
    // Alias snake_case tidak membawa operation_id camelCase — terima juga
    // bentuk snake_case mentah.
    if (!lastOp || typeof (lastOp as Record<string, unknown>).operationId !== 'string') return null;
  }
  const stepsRaw = Array.isArray(lastOp.steps) ? lastOp.steps : [];
  const errorRaw = (lastOp.error ?? null) as Record<string, unknown> | null;
  const resultRaw = (lastOp.result ?? {}) as Record<string, unknown>;
  const type = pick(lastOp.type) as BrokerConfigLastOperation['type'];
  const status = pick(lastOp.status) as BrokerConfigLastOperation['status'];
  const domainStatus = pick(lastOp.domainStatus, lastOp.domain_status) as BrokerConfigLastOperation['domainStatus'];
  const domainAction = pick(lastOp.domainAction, lastOp.domain_action) as BrokerConfigLastOperation['domainAction'];
  return {
    operation_id: str(pick(lastOp.operation_id, lastOp.operationId)),
    version_id: str(pick(lastOp.version_id, lastOp.versionId)),
    type: type === 'APPLY' || type === 'ROLLBACK' || type === 'DISCARD' ? type : null,
    status: status === 'PENDING' || status === 'RUNNING' || status === 'SUCCEEDED' || status === 'FAILED' ? status : 'PENDING',
    domainStatus:
      domainStatus === 'QUEUED' || domainStatus === 'RUNNING' || domainStatus === 'SUCCEEDED' || domainStatus === 'FAILED' || domainStatus === 'ROLLED_BACK' || domainStatus === 'INTERRUPTED'
        ? domainStatus
        : 'QUEUED',
    domainAction: domainAction === 'APPLY' || domainAction === 'ROLLBACK' || domainAction === 'RECOVERY' ? domainAction : 'APPLY',
    phase: str(pick(lastOp.phase)),
    actorId: str(pick(lastOp.actorId, lastOp.actor_id)),
    actorName: str(pick(lastOp.actorName, lastOp.actor_name)),
    reason: (pick(lastOp.reason) as string | null) ?? null,
    startedAt: str(pick(lastOp.startedAt, lastOp.started_at)),
    finishedAt: (pick(lastOp.finishedAt, lastOp.finished_at) as string | null) ?? null,
    steps: stepsRaw.map((s) => {
      const st = (s ?? {}) as Record<string, unknown>;
      return {
        name: str(pick(st.name, st.step)),
        status: str(pick(st.status)),
        startedAt: str(pick(st.startedAt, st.started_at)),
        finishedAt: (pick(st.finishedAt, st.finished_at) as string | null) ?? null,
        detail: (pick(st.detail) as string | undefined) ?? undefined,
      };
    }),
    error:
      errorRaw && typeof errorRaw.code === 'string'
        ? { code: errorRaw.code, message: str(pick(errorRaw.message)) }
        : null,
    result: {
      previousVersionId: (pick(resultRaw.previousVersionId, resultRaw.previous_version_id) as string | null) ?? null,
      appliedVersionId: (pick(resultRaw.appliedVersionId, resultRaw.applied_version_id) as string | null) ?? null,
      rollbackAttempted: bool(pick(resultRaw.rollbackAttempted, resultRaw.rollback_attempted), false),
      rollbackSucceeded: bool(pick(resultRaw.rollbackSucceeded, resultRaw.rollback_succeeded), false),
    },
  };
}

/**
 * E23 Batch 1 (FAT-179, N-10): `GET /mqtt/configuration/status` — bentuk
 * spec live `{runtime, lock, current, lastOperation, lastAppliedVersionId}`
 * (menjawab AUDIT §24.1). Bentuk lama (`status`/`activeVersionId`/
 * `lastAppliedAt`/`mutationLocked`/`lastOperation` string/`measuredAt`
 * top-level) TIDAK ADA di spec — mapper lama selalu menghasilkan
 * `'UNAVAILABLE'`.
 */
export function mapBrokerConfigStatus(raw: unknown): BrokerConfigStatus {
  const r = (raw ?? {}) as Record<string, unknown>;
  const runtime = (r.runtime ?? {}) as Record<string, unknown>;
  const lock = (r.lock ?? {}) as Record<string, unknown>;
  const current = (r.current ?? null) as Record<string, unknown> | null;
  const capability = (v: unknown): { available: boolean; reason?: string | null } => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      available: bool(pick(o.available), false),
      reason: (pick(o.reason) as string | null) ?? null,
    };
  };
  const mode = pick(runtime.mode) as BrokerConfigStatus['runtime']['mode'];
  return {
    runtime: {
      mode: mode === 'helper' || mode === 'native' || mode === 'disabled' ? mode : null,
      available: bool(pick(runtime.available), false),
      validation: capability(runtime.validation),
      reload: capability(runtime.reload),
      restart: capability(runtime.restart),
      apply: capability(runtime.apply),
      targetContainer: (pick(runtime.targetContainer, runtime.target_container) as string | null) ?? null,
      targetImage: (pick(runtime.targetImage, runtime.target_image) as string | null) ?? null,
      lastError: (pick(runtime.lastError, runtime.last_error) as string | null) ?? null,
    },
    lock: {
      held: bool(pick(lock.held), false),
      stale: bool(pick(lock.stale), false),
      ownerPid: (pick(lock.ownerPid, lock.owner_pid) as number | null) ?? null,
      startedAt: (pick(lock.startedAt, lock.started_at) as string | null) ?? null,
      operationId: (pick(lock.operationId, lock.operation_id) as string | null) ?? null,
    },
    current:
      current && typeof current.checksum === 'string'
        ? {
            checksum: current.checksum,
            sizeBytes: num(pick(current.sizeBytes, current.size_bytes), 0),
            modifiedAt: str(pick(current.modifiedAt, current.modified_at)),
          }
        : null,
    lastOperation: mapBrokerConfigLastOperation(r.lastOperation ?? r.last_operation ?? null),
    lastAppliedVersionId: (pick(r.lastAppliedVersionId, r.last_applied_version_id) as string | null) ?? null,
  };
}

/** Angka bila berupa number berhingga, `null` bila null/absen (§3.3b). */
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * FAT-285 (E32.4): pemetaan `GET /mqtt/configuration` — dipindah verbatim
 * dari `http/mqttConfig.ts` (dulu inline di `getBrokerConfig`).
 */
export function mapBrokerConfigSchema(raw: unknown): BrokerConfigSchema {
  const r = (raw ?? {}) as Record<string, unknown>;
  const general = (r.general ?? {}) as Record<string, unknown>;
  const limits = (r.limits ?? {}) as Record<string, unknown>;
  return {
    version: str(pick(r.version), '1'),
    general: {
      per_listener_settings: bool(general.per_listener_settings, false),
      allow_anonymous: bool(general.allow_anonymous, false),
      // E20 P20.5 (FAT-157): field tanpa sumber = `null` — HAPUS
      // default fabrikasi (autosave 300; §3.3b).
      autosave_interval_seconds: numOrNull(general.autosave_interval_seconds),
      persistence: bool(general.persistence, true),
      persistence_location: str(general.persistence_location, ''),
      log_dest: (general.log_dest as string[]) ?? [],
      log_type: (general.log_type as string[]) ?? [],
      connection_messages: bool(general.connection_messages, true),
    },
    limits: {
      // E20 P20.5 (FAT-157): HAPUS default fabrikasi `max_connections`
      // 1000, `max_packet_size_bytes` 268435456, `max_queued_bytes` 0 —
      // field tanpa sumber = `null` (§3.3b).
      // E23 Batch 3 (FAT-198, N-29): sisa default fabrikasi
      // `max_queued_messages` 1000 / `max_inflight_messages` 20 juga
      // dihapus (spec nullable) — null tetap null.
      max_connections: numOrNull(limits.max_connections),
      max_packet_size_bytes: numOrNull(limits.max_packet_size_bytes),
      max_queued_messages: numOrNull(limits.max_queued_messages),
      max_queued_bytes: numOrNull(limits.max_queued_bytes),
      max_inflight_messages: numOrNull(limits.max_inflight_messages),
    },
    listeners: (r.listeners as BrokerConfigSchema['listeners']) ?? [],
    // E20 P20.5 (FAT-157): `tls_profiles` selalu `[]` (§3.3b) —
    // TLS melekat pada listener/bridge, bukan profil terpisah.
    tls_profiles: [],
    bridges: (r.bridges as BrokerConfigSchema['bridges']) ?? [],
    // E23 Batch 3 (FAT-198, N-29): `unmanaged[]` spec berupa objek
    // `{key, section, line, reason}` — petakan sebagai objek (dulu
    // `String(u)` → "[object Object]"). Item bukan objek dilewati.
    unmanaged: Array.isArray(r.unmanaged)
      ? (r.unmanaged as unknown[])
          .filter((u): u is Record<string, unknown> => typeof u === 'object' && u !== null)
          .map((u) => ({
            key: str(pick(u.key)),
            section: str(pick(u.section)),
            line: num(pick(u.line), 0),
            reason: str(pick(u.reason)),
          }))
      : [],
  };
}

/**
 * FAT-285 (E32.4): pemetaan `GET /mqtt/configuration/raw` — dipindah
 * verbatim dari `http/mqttConfig.ts` (dulu inline di `getBrokerConfigRaw`).
 *
 * E23 Batch 3 (FAT-199, N-30): spec live mengembalikan JSON
 * `{metadata:{source, checksum, sizeBytes, modifiedAt,
 * mosquittoVersion}, text}` — `text` adalah isi mosquitto.conf (bukan
 * dokumen JSON utuh). Bila server mengembalikan teks polos (bentuk
 * lama), pakai teks itu dengan metadata null.
 */
export function mapBrokerConfigRawResult(json: unknown, rawText: string): BrokerConfigRawResult {
  const obj = (json ?? null) as Record<string, unknown> | null;
  if (obj && typeof obj.text === 'string') {
    const meta = (obj.metadata ?? null) as Record<string, unknown> | null;
    return {
      text: obj.text,
      metadata:
        meta && typeof meta.checksum === 'string'
          ? {
              source: str(pick(meta.source)),
              checksum: meta.checksum,
              sizeBytes: num(pick(meta.sizeBytes, meta.size_bytes), 0),
              modifiedAt: str(pick(meta.modifiedAt, meta.modified_at)),
              mosquittoVersion: str(pick(meta.mosquittoVersion, meta.mosquitto_version)),
            }
          : null,
    };
  }
  return { text: rawText, metadata: null };
}

/**
 * FAT-285 (E32.4): pemetaan satu baris `GET /mqtt/configuration/backups`
 * — dipindah verbatim dari `http/mqttConfig.ts` (dulu inline di
 * `getBrokerConfigBackups`).
 */
export function mapBrokerBackup(raw: unknown): BrokerBackup {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    backup_id: str(pick(r.backup_id, r.backupId, r.id)),
    filename: str(pick(r.filename, r.name)),
    version_id: str(pick(r.version_id, r.versionId)),
    created_at: iso(pick(r.created_at, r.createdAt)),
    size_bytes: num(pick(r.size_bytes, r.sizeBytes), 0),
  } satisfies BrokerBackup;
}
