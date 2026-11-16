/**
 * Method HTTP — domain mqttConfig.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, calledKeys, assertLanForMutation, assertAuthenticatedHttp, fetchRaw, reqJson, reqList, checkAbortHttp } from './transport';
import { mapBrokerConfigVersion, mapBrokerOperation } from './mappers';
import { num, str, bool, iso, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ApiError } from '../../../types/auth';
import { BrokerConfigSchema, BrokerConfigVersion, BrokerOperation, BrokerBackup } from '../../../types/mqtt';

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
            autosave_interval_seconds: num(general.autosave_interval_seconds, 300),
            persistence: bool(general.persistence, true),
            persistence_location: str(general.persistence_location, ''),
            log_dest: (general.log_dest as string[]) ?? [],
            log_type: (general.log_type as string[]) ?? [],
            connection_messages: bool(general.connection_messages, true),
          },
          limits: {
            max_connections: num(limits.max_connections, 1000),
            max_packet_size_bytes: num(limits.max_packet_size_bytes, 268435456),
            max_queued_messages: num(limits.max_queued_messages, 1000),
            max_queued_bytes: num(limits.max_queued_bytes, 0),
            max_inflight_messages: num(limits.max_inflight_messages, 20),
          },
          listeners: (r.listeners as BrokerConfigSchema['listeners']) ?? [],
          tls_profiles: (r.tls_profiles as BrokerConfigSchema['tls_profiles']) ?? [],
          bridges: (r.bridges as BrokerConfigSchema['bridges']) ?? [],
        };
      },
    );
  },

  async getBrokerConfigRaw(signal?: AbortSignal): Promise<string> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await fetchRaw({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_RAW.buildPath(),
      signal,
      endpointKey: 'MQTT_CONFIG_RAW',
    });
    calledKeys.add('MQTT_CONFIG_RAW');
    return raw.text;
  },

  async getBrokerConfigStatus(signal?: AbortSignal): Promise<{
    active_version: string;
    sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
    last_applied_at: string;
    mutation_locked: boolean;
  }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath(), signal, endpointKey: 'MQTT_CONFIG_STATUS', capability: 'mqtt.config.read' },
      (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          active_version: str(pick(r.active_version, r.activeVersionId, r.activeVersion), ''),
          sync_state: (pick(r.sync_state, r.syncState, r.status, 'IN_SYNC') as 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED'),
          last_applied_at: iso(pick(r.last_applied_at, r.lastAppliedAt)),
          mutation_locked: bool(pick(r.mutation_locked, r.mutationLocked), false),
        };
      },
    );
  },

  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath(),
      body: { config: newConfig, summary },
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

  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<{ version_id: string; diff_summary: string; changed_keys: string[] }> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId),
      signal,
      endpointKey: 'MQTT_CONFIG_VERSION_DIFF',
      capability: 'mqtt.config.read',
      resourceId: versionId,
    });
    return {
      version_id: str(pick(raw.version_id, raw.versionId, versionId)),
      diff_summary: str(pick(raw.diff_summary, raw.diffSummary, raw.summary), ''),
      changed_keys: ((raw.changed_keys ?? raw.changedKeys ?? []) as unknown[]).map((k) => String(k)),
    };
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

  async applyBrokerConfigVersion(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
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
    });
    return {
      version: mapBrokerConfigVersion(raw.version ?? raw),
      operation: mapBrokerOperation(raw.operation ?? raw),
    };
  },

  async applyBrokerConfig(newConfig: BrokerConfigSchema, summary: string, reason?: string): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const staged = await httpMqttConfig.stageBrokerConfig(newConfig, summary);
    return httpMqttConfig.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary });
  },

  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm?: boolean; reason?: string } = {},
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
    });
    return {
      version: mapBrokerConfigVersion(raw.version ?? raw),
      operation: mapBrokerOperation(raw.operation ?? raw),
    };
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

  async createBrokerConfigBackup(): Promise<{ success: boolean; versionId?: string; name?: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath(),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MQTT_CONFIG_BACKUPS',
      capability: 'mqtt.config.manage',
    });
    return {
      success: bool(raw.success, true),
      versionId: raw.versionId ? String(raw.versionId) : raw.id ? String(raw.id) : undefined,
      name: raw.name ? String(raw.name) : undefined,
    };
  }
};
