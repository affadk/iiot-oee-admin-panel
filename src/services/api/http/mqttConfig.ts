/**
 * Method HTTP — domain mqttConfig.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, calledKeys, assertLanForMutation, assertAuthenticatedHttp, fetchRaw, reqJson, reqList, checkAbortHttp, sleep } from './transport';
import { mapBrokerConfigVersion, mapBrokerConfigStatus, mapBrokerConfigDiff, mapBrokerOperation, mapBrokerConfigSchema, mapBrokerConfigRawResult, mapBrokerBackup } from './mappers';
import { str, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ApiError } from '../../../types/auth';
import { BrokerConfigSchema, BrokerConfigStatus, BrokerConfigVersion, BrokerConfigDiffResult, BrokerOperation, BrokerBackup, BrokerConfigRawResult } from '../../../types/mqtt';

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
      mapBrokerConfigSchema,
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
    return mapBrokerConfigRawResult(raw.json, raw.text);
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
    options: { confirm?: boolean; reason?: string; acknowledgeUnvalidated?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_APPLY.buildPath(versionId),
      // E28 Batch A (B41): spec 20 Nov — body apply = {acknowledgeUnvalidated,
      // confirm, reason}. Kirim acknowledgeUnvalidated=true HANYA bila
      // pemanggil tahu staging config belum tervalidasi; bila tidak
      // diketahui, omit (jangan karang true).
      body: {
        confirm: options.confirm ?? true,
        ...(options.acknowledgeUnvalidated !== undefined
          ? { acknowledgeUnvalidated: options.acknowledgeUnvalidated }
          : {}),
        ...(options.reason ? { reason: options.reason } : {}),
      },
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
    // E28 Batch A (B41): staging yang belum tervalidasi (validation.status
    // bukan 'passed') diakui eksplisit saat apply — bila status tidak
    // diketahui (validation absen), omit.
    const acknowledgeUnvalidated =
      staged.validation && staged.validation.status !== 'passed' ? true : undefined;
    return httpMqttConfig.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary, acknowledgeUnvalidated });
  },

  /**
   * E20 P20.5 (FAT-157, R22): rollback async — sama seperti apply:
   * `202 {operationId, versionId}` + polling sampai terminal. Rollback
   * membuat operasi + versi BARU (§3.3b); `versionId` respons adalah versi
   * hasil rollback itu.
   */
  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm?: boolean; reason?: string; acknowledgeUnvalidated?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_ROLLBACK.buildPath(versionId),
      // E28 Batch A (B41): sama seperti apply — body rollback =
      // {acknowledgeUnvalidated, confirm, reason} (spec 20 Nov).
      body: {
        confirm: options.confirm ?? true,
        ...(options.acknowledgeUnvalidated !== undefined
          ? { acknowledgeUnvalidated: options.acknowledgeUnvalidated }
          : {}),
        ...(options.reason ? { reason: options.reason } : {}),
      },
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
      mapBrokerBackup,
      50,
    ).then((p) => p.data);
  },

  // E20 P20.5 (FAT-157, X3/R24): `POST /backups` DIHAPUS — endpoint tidak
  // ada (§3.3b: 404; backup dibuat otomatis saat apply/rollback).
  // `GET /backups` (inventaris) tetap ada di atas.
};
