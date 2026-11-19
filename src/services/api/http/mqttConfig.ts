/**
 * Method HTTP — domain mqttConfig.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, calledKeys, assertLanForMutation, assertAuthenticatedHttp, fetchRaw, reqJson, reqList, checkAbortHttp, sleep } from './transport';
import { mapBrokerConfigVersion, mapBrokerConfigStatus, mapBrokerConfigDiff, mapBrokerOperation } from './mappers';
import { num, str, bool, iso, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ApiError } from '../../../types/auth';
import { BrokerConfigSchema, BrokerConfigStatus, BrokerConfigVersion, BrokerConfigDiffResult, BrokerOperation, BrokerBackup, BrokerConfigRawResult } from '../../../types/mqtt';

/** Angka bila berupa number berhingga, `null` bila null/absen (§3.3b). */
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Polling operasi sampai terminal (SUCCEEDED/FAILED) — maks 30 × 500 md. */
async function pollBrokerOperationUntilTerminal(
  operationId: string,
  signal?: AbortSignal,
): Promise<BrokerOperation> {
  let last: BrokerOperation | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    checkAbortHttp(signal);
    const op = await httpMqttConfig.getBrokerConfigOperation(operationId, signal);
    if (op) {
      last = op;
      if (op.status === 'SUCCEEDED' || op.status === 'FAILED') return op;
    }
    await sleep(500);
  }
  if (last) return last;
  throw new ApiError({
    code: 'MQTT_RESPONSE_TIMEOUT',
    message: `Operasi konfigurasi ${operationId} tidak mencapai status terminal setelah polling.`,
    httpStatus: 504,
  });
}

export const httpMqttConfig = {
  async getBrokerConfig(signal?: AbortSignal): Promise<BrokerConfigSchema> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_GET.buildPath(), signal, endpointKey: 'MQTT_CONFIG_GET', capability: 'mqtt.config.read' },
      (raw) => {
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
      },
    );
  },

  /**
   * E23 Batch 3 (FAT-199, N-30): spec live mengembalikan JSON
   * `{metadata:{source, checksum, sizeBytes, modifiedAt,
   * mosquittoVersion}, text}` — `text` adalah isi mosquitto.conf (bukan
   * dokumen JSON utuh). Bila server mengembalikan teks polos (bentuk
   * lama), pakai teks itu dengan metadata null.
   */
  async getBrokerConfigRaw(signal?: AbortSignal): Promise<BrokerConfigRawResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await fetchRaw({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_RAW.buildPath(),
      signal,
      endpointKey: 'MQTT_CONFIG_RAW',
    });
    calledKeys.add('MQTT_CONFIG_RAW');
    const json = (raw.json ?? null) as Record<string, unknown> | null;
    if (json && typeof json.text === 'string') {
      const meta = (json.metadata ?? null) as Record<string, unknown> | null;
      return {
        text: json.text,
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
    return { text: raw.text, metadata: null };
  },

  /**
   * E23 Batch 1 (FAT-179, N-10): `GET /mqtt/configuration/status` — bentuk
   * spec live `{runtime, lock, current, lastOperation, lastAppliedVersionId}`
   * (mapper `mapBrokerConfigStatus`); bentuk lama yang dibaca inline di sini
   * (`status`/`activeVersionId`/…) tidak ada di spec → status selalu
   * `'UNAVAILABLE'`.
   */
  async getBrokerConfigStatus(signal?: AbortSignal): Promise<BrokerConfigStatus> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath(), signal, endpointKey: 'MQTT_CONFIG_STATUS', capability: 'mqtt.config.read' },
      mapBrokerConfigStatus,
    );
  },

  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // E23 Batch 1 (FAT-181, N-12): spec live — `bridges[]` POST wajib
    // `remote_address` (string, bukan null hasil GET); `password` tidak
    // pernah dikembalikan GET (hanya `has_password`) sehingga harus diisi
    // ulang via editor (field `BrokerBridge.password`, transient) — bila
    // kosong, password TIDAK dikirim (bukan string kosong). Bridge tanpa
    // remote_address ditolak di klien sebelum request (400/422 server).
    const bridges = (newConfig.bridges ?? []).map((b) => {
      const remote_address = typeof b.remote_address === 'string' ? b.remote_address.trim() : '';
      if (!remote_address) {
        throw new ApiError({
          code: 'INVALID_REQUEST',
          message: `Bridge "${b.name || b.id}" belum punya remote_address — isi alamat remote sebelum staging.`,
          httpStatus: 400,
        });
      }
      const { password, ...rest } = b;
      return { ...rest, remote_address, ...(password ? { password } : {}) };
    });
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath(),
      body: { config: { ...newConfig, bridges }, summary },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_STAGE',
      capability: 'mqtt.config.manage',
    });
    return mapBrokerConfigVersion(raw.version ?? raw);
  },

  async getBrokerConfigVersions(limit = 100, signal?: AbortSignal): Promise<BrokerConfigVersion[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_LIST.buildPath(), query: { limit }, signal, endpointKey: 'MQTT_CONFIG_LIST', capability: 'mqtt.config.read' },
      mapBrokerConfigVersion,
      limit,
    ).then((p) => p.data);
  },

  async getBrokerConfigVersion(versionId: string, signal?: AbortSignal): Promise<BrokerConfigVersion> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_GET.buildPath(versionId), signal, endpointKey: 'MQTT_CONFIG_VERSION_GET', capability: 'mqtt.config.read', resourceId: versionId },
      mapBrokerConfigVersion,
    );
  },

  /**
   * E23 Batch 1 (FAT-182, N-13): `GET /configurations/{versionId}/diff` —
   * bentuk spec live `{baseVersionId, versionId, baseChecksum, checksum,
   * truncated, lines[]}`. Field lama `diff_summary`/`changed_keys` tidak
   * ada di spec — diff selalu kosong sebelumnya.
   */
  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<BrokerConfigDiffResult> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId),
      signal,
      endpointKey: 'MQTT_CONFIG_VERSION_DIFF',
      capability: 'mqtt.config.read',
      resourceId: versionId,
    });
    const diff = mapBrokerConfigDiff(raw);
    if (!diff) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Respons diff konfigurasi tidak memuat lines[].',
        httpStatus: 200,
      });
    }
    return { ...diff, version_id: str(pick(raw.version_id, raw.versionId, diff.versionId, versionId)) };
  },

  async deleteBrokerConfigVersion(versionId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DELETE.buildPath(versionId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_DELETE',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
    });
    return { success: raw?.success ?? true };
  },

  /**
   * E20 P20.5 (FAT-157, R21): apply async — harap `202 {operationId,
   * versionId}` (bukan `{version, operation}`), lalu POLLING
   * `GET /operations/:operationId` sampai terminal (PENDING/RUNNING →
   * SUCCEEDED/FAILED). Body `{confirm: true}` (+ reason opsional).
   * Return `{version, operation}` dipertahankan untuk pemanggil UI.
   */
  async applyBrokerConfigVersion(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
    signal?: AbortSignal,
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_APPLY.buildPath(versionId),
      body: { confirm: options.confirm ?? true, ...(options.reason ? { reason: options.reason } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_APPLY',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
      signal,
    });
    const operationId = str(pick(raw.operationId, raw.operation_id));
    const resolvedVersionId = str(pick(raw.versionId, raw.version_id, versionId));
    if (!operationId) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Respons apply konfigurasi tidak memuat operationId.',
        httpStatus: 200,
      });
    }
    const operation = await pollBrokerOperationUntilTerminal(operationId, signal);
    const version = await httpMqttConfig.getBrokerConfigVersion(resolvedVersionId, signal);
    return { version, operation };
  },

  async applyBrokerConfig(newConfig: BrokerConfigSchema, summary: string, reason?: string): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const staged = await httpMqttConfig.stageBrokerConfig(newConfig, summary);
    return httpMqttConfig.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary });
  },

  /**
   * E20 P20.5 (FAT-157, R22): rollback async — sama seperti apply:
   * `202 {operationId, versionId}` + polling sampai terminal. Rollback
   * membuat operasi + versi BARU (§3.3b); `versionId` respons adalah versi
   * hasil rollback itu.
   */
  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
    signal?: AbortSignal,
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_ROLLBACK.buildPath(versionId),
      body: { confirm: options.confirm ?? true, ...(options.reason ? { reason: options.reason } : {}) },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_VERSION_ROLLBACK',
      capability: 'mqtt.config.manage',
      resourceId: versionId,
      signal,
    });
    const operationId = str(pick(raw.operationId, raw.operation_id));
    const resolvedVersionId = str(pick(raw.versionId, raw.version_id, versionId));
    if (!operationId) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Respons rollback konfigurasi tidak memuat operationId.',
        httpStatus: 200,
      });
    }
    const operation = await pollBrokerOperationUntilTerminal(operationId, signal);
    const version = await httpMqttConfig.getBrokerConfigVersion(resolvedVersionId, signal);
    return { version, operation };
  },

  async getBrokerConfigOperations(limit = 50, signal?: AbortSignal): Promise<BrokerOperation[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATIONS.buildPath(), query: { limit }, signal, endpointKey: 'MQTT_CONFIG_OPERATIONS', capability: 'mqtt.config.read' },
      mapBrokerOperation,
      limit,
    ).then((p) => p.data);
  },

  async getBrokerConfigOperation(operationId: string, signal?: AbortSignal): Promise<BrokerOperation | null> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    try {
      return await reqJson(
        { path: ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATION_GET.buildPath(operationId), signal, endpointKey: 'MQTT_CONFIG_OPERATION_GET', capability: 'mqtt.config.read', resourceId: operationId },
        mapBrokerOperation,
      );
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 404) return null;
      throw err;
    }
  },

  async getBrokerConfigBackups(signal?: AbortSignal): Promise<BrokerBackup[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList<BrokerBackup>(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath(), signal, endpointKey: 'MQTT_CONFIG_BACKUPS', capability: 'mqtt.config.read' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          backup_id: str(pick(r.backup_id, r.backupId, r.id)),
          filename: str(pick(r.filename, r.name)),
          version_id: str(pick(r.version_id, r.versionId)),
          created_at: iso(pick(r.created_at, r.createdAt)),
          size_bytes: num(pick(r.size_bytes, r.sizeBytes), 0),
        } satisfies BrokerBackup;
      },
      50,
    ).then((p) => p.data);
  },

  // E20 P20.5 (FAT-157, X3/R24): `POST /backups` DIHAPUS — endpoint tidak
  // ada (§3.3b: 404; backup dibuat otomatis saat apply/rollback).
  // `GET /backups` (inventaris) tetap ada di atas.
};
