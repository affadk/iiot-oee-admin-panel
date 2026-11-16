/**
 * Method demo — domain mqttConfig.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { BrokerConfigSchema, BrokerConfigVersion, BrokerOperation, BrokerBackup } from '../../../types/mqtt';
import { ApiError } from '../../../types/auth';

export const demoMqttConfig = {
  // =========================================================================
  // MQTT BROKER CONFIGURATION MANAGER (13 Canonical Operations)
  // =========================================================================
  async getBrokerConfig(signal?: AbortSignal): Promise<BrokerConfigSchema> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_GET.buildPath());
    return JSON.parse(JSON.stringify(store.brokerConfig));
  },

  async getBrokerConfigRaw(signal?: AbortSignal): Promise<string> {
    checkAbort(signal);
    assertCapability('mqtt.config.read_raw', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_RAW', ADMIN_ENDPOINTS.MQTT_CONFIG_RAW.buildPath());
    const c = store.brokerConfig;
    const listenerLines = c.listeners
      .map(
        (l) =>
          `listener ${l.port} ${l.bind_address}\nprotocol ${l.protocol}\nmax_connections ${l.max_connections}`
      )
      .join('\n\n');
    return [
      `# Mosquitto Broker Configuration (${c.version})`,
      `per_listener_settings ${c.general.per_listener_settings}`,
      `allow_anonymous ${c.general.allow_anonymous}`,
      `persistence ${c.general.persistence}`,
      `persistence_location ${c.general.persistence_location}`,
      `autosave_interval ${c.general.autosave_interval_seconds}`,
      `max_packet_size ${c.limits.max_packet_size_bytes}`,
      `max_queued_messages ${c.limits.max_queued_messages}`,
      '',
      listenerLines,
    ].join('\n');
  },

  async getBrokerConfigStatus(signal?: AbortSignal): Promise<{
    active_version: string;
    sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
    last_applied_at: string;
    mutation_locked: boolean;
  }> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_STATUS', ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath());
    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    return {
      active_version: activeVer?.version_id ?? store.brokerConfig.version,
      sync_state: 'IN_SYNC',
      last_applied_at: activeVer?.applied_at ?? '2026-11-08T14:20:00Z',
      mutation_locked: false,
    };
  },

  async getBrokerConfigVersions(limit = 100, signal?: AbortSignal): Promise<BrokerConfigVersion[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_LIST', `${ADMIN_ENDPOINTS.MQTT_CONFIG_LIST.buildPath()}?limit=${limit}`);
    return store.configVersions.slice(0, Math.min(500, limit)).map((v) => JSON.parse(JSON.stringify(v)));
  },

  async getBrokerConfigVersion(versionId: string, signal?: AbortSignal): Promise<BrokerConfigVersion> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false, resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_GET.buildPath(versionId));
    const v = store.configVersions.find((ver) => ver.version_id === versionId);
    if (!v) throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    return JSON.parse(JSON.stringify(v));
  },

  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<{ version_id: string; diff_summary: string; changed_keys: string[] }> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false, resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_DIFF', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId));
    const v = store.configVersions.find((ver) => ver.version_id === versionId);
    if (!v) throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });

    const changedKeys: string[] = [];
    if (v.config.general.autosave_interval_seconds !== store.brokerConfig.general.autosave_interval_seconds) {
      changedKeys.push('general.autosave_interval_seconds');
    }
    if (v.config.limits.max_connections !== store.brokerConfig.limits.max_connections) {
      changedKeys.push('limits.max_connections');
    }
    if (v.config.limits.max_queued_messages !== store.brokerConfig.limits.max_queued_messages) {
      changedKeys.push('limits.max_queued_messages');
    }
    if (JSON.stringify(v.config.listeners) !== JSON.stringify(store.brokerConfig.listeners)) {
      changedKeys.push('listeners');
    }
    if (changedKeys.length === 0) changedKeys.push('metadata.summary');

    return {
      version_id: versionId,
      diff_summary: v.summary,
      changed_keys: changedKeys,
    };
  },

  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertCapability('mqtt.config.manage', ['ADMIN']);
    store.recordEndpoint('MQTT_CONFIG_STAGE', ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath());

    const issues: Array<{ field: string; message: string }> = [];
    if (newConfig.limits.max_connections < 10 || newConfig.limits.max_connections > 50000) {
      issues.push({ field: 'limits.max_connections', message: 'Max connections wajib antara 10–50.000.' });
    }
    if (newConfig.general.autosave_interval_seconds < 60) {
      issues.push({ field: 'general.autosave_interval_seconds', message: 'Autosave interval minimal 60 detik.' });
    }
    if (newConfig.listeners.length === 0) {
      issues.push({ field: 'listeners', message: 'Minimal 1 listener MQTT wajib aktif.' });
    }
    if (issues.length > 0) {
      throw new ApiError({
        code: 'CONFIG_VALIDATION_FAILED',
        message: 'Validasi pengaturan koneksi gagal sebelum disimpan sebagai draf.',
        httpStatus: 422,
        issues,
      });
    }

    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    const versionId = `cfg-staged-${Date.now().toString().slice(-5)}`;
    const staged: BrokerConfigVersion = {
      version_id: versionId,
      parent_version_id: activeVer?.version_id ?? null,
      applied_at: new Date().toISOString(),
      applied_by: store.currentUserName,
      summary: summary.trim() || 'Staged configuration draft via Admin Console',
      operation_type: 'RELOAD',
      status: 'STAGED',
      config: JSON.parse(JSON.stringify(newConfig)),
    };
    store.configVersions.unshift(staged);
    store.brokerOperations.unshift({
      operation_id: `op-cfg-${Date.now().toString().slice(-5)}`,
      type: 'STAGE',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: staged.summary,
      steps: [{ step: 'STAGE_DRAFT', status: 'SUCCEEDED', message: 'Konfigurasi kandidat tersimpan' }],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return JSON.parse(JSON.stringify(staged));
  },

  async deleteBrokerConfigVersion(versionId: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_DELETE', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DELETE.buildPath(versionId));
    const target = store.configVersions.find((v) => v.version_id === versionId);
    if (!target) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    }
    if (target.status !== 'STAGED') {
      throw new ApiError({
        code: 'CONFLICT',
        message: 'Hanya versi berstatus STAGED yang dapat dibuang (discard).',
        httpStatus: 409,
      });
    }
    store.configVersions = store.configVersions.filter((v) => v.version_id !== versionId);
    return { success: true };
  },

  async applyBrokerConfigVersion(
    versionId: string,
    options: { confirm: boolean; reason?: string }
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    if (!options?.confirm) {
      throwValidationIssues('Konfirmasi eksplisit confirm=true wajib disertakan untuk apply konfigurasi broker.', {
        confirm: 'Wajib true.',
      });
    }
    if (options.reason && options.reason.length > 500) {
      throwValidationIssues('Alasan apply maksimal 500 karakter.', { reason: 'Maksimal 500 karakter.' });
    }

    store.recordEndpoint('MQTT_CONFIG_VERSION_APPLY', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_APPLY.buildPath(versionId));
    const target = store.configVersions.find((v) => v.version_id === versionId);
    if (!target) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    }

    store.configVersions.forEach((v) => {
      if (v.status === 'ACTIVE') v.status = 'APPLIED';
    });
    target.status = 'ACTIVE';
    target.applied_at = new Date().toISOString();
    target.applied_by = store.currentUserName;
    store.brokerConfig = JSON.parse(JSON.stringify(target.config));

    const operation: BrokerOperation = {
      operation_id: `op-apply-${Date.now().toString().slice(-5)}`,
      type: 'APPLY',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: options.reason?.trim() || target.summary,
      steps: [
        { step: 'VALIDATE_SCHEMA', status: 'SUCCEEDED', message: 'Pemeriksaan format pengaturan berhasil' },
        { step: 'WRITE_BACKUP', status: 'SUCCEEDED', message: 'Cadangan otomatis tersimpan' },
        { step: 'RELOAD_BROKER', status: 'SUCCEEDED', message: 'Layanan koneksi dimuat ulang tanpa memutus sambungan' },
      ],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    store.brokerOperations.unshift(operation);
    store.brokerBackups.unshift({
      backup_id: `bak-${Date.now().toString().slice(-4)}`,
      filename: `mosquitto-${new Date().toISOString().replace(/[:.]/g, '-')}.conf.bak`,
      version_id: versionId,
      created_at: new Date().toISOString(),
      size_bytes: 2910,
    });
    store.addAudit('BROKER_CONFIG_APPLIED', 'BROKER_CONFIG', versionId, operation.reason || target.summary);
    return {
      version: JSON.parse(JSON.stringify(target)),
      operation,
    };
  },

  async applyBrokerConfig(newConfig: BrokerConfigSchema, summary: string, reason?: string) {
    const staged = await demoMqttConfig.stageBrokerConfig(newConfig, summary);
    return demoMqttConfig.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary });
  },

  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm: boolean; reason?: string } = { confirm: true }
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    if (!options?.confirm) {
      throwValidationIssues('Konfirmasi eksplisit confirm=true wajib disertakan untuk rollback konfigurasi.', {
        confirm: 'Wajib true.',
      });
    }
    store.recordEndpoint(
      'MQTT_CONFIG_VERSION_ROLLBACK',
      ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_ROLLBACK.buildPath(versionId)
    );
    const targetVer = store.configVersions.find((v) => v.version_id === versionId);
    if (!targetVer) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi target tidak ditemukan.', httpStatus: 404 });
    }

    store.brokerConfig = JSON.parse(JSON.stringify(targetVer.config));
    store.configVersions.forEach((v) => {
      if (v.status === 'ACTIVE') v.status = 'ROLLED_BACK';
    });
    targetVer.status = 'ACTIVE';
    targetVer.applied_at = new Date().toISOString();

    const operation: BrokerOperation = {
      operation_id: `op-rb-${Date.now().toString().slice(-5)}`,
      type: 'ROLLBACK',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: options.reason?.trim() || `Rollback ke versi ${versionId}`,
      steps: [
        { step: 'RESTORE_SNAPSHOT', status: 'SUCCEEDED', message: `Snapshot ${versionId} dipulihkan` },
        { step: 'RELOAD_BROKER', status: 'SUCCEEDED', message: 'Layanan koneksi berhasil dimuat ulang' },
      ],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    store.brokerOperations.unshift(operation);
    store.addAudit('BROKER_CONFIG_ROLLBACK', 'BROKER_CONFIG', versionId, `Rolled back to ${versionId}`);
    return {
      version: JSON.parse(JSON.stringify(targetVer)),
      operation,
    };
  },

  async getBrokerConfigOperations(limit = 50, signal?: AbortSignal): Promise<BrokerOperation[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_OPERATIONS', `${ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATIONS.buildPath()}?limit=${limit}`);
    return store.brokerOperations.slice(0, Math.min(500, limit)).map((o) => ({ ...o }));
  },

  async getBrokerConfigOperation(operationId: string, signal?: AbortSignal): Promise<BrokerOperation | null> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_OPERATION_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATION_GET.buildPath(operationId));
    const op = store.brokerOperations.find((o) => o.operation_id === operationId);
    return op ? { ...op } : null;
  },

  async getBrokerConfigBackups(signal?: AbortSignal): Promise<BrokerBackup[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_BACKUPS', ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath());
    return store.brokerBackups.map((b) => ({ ...b }));
  }
};
