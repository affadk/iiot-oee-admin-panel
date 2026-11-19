/**
 * Method demo — domain mqttConfig.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { BrokerConfigSchema, BrokerConfigStatus, BrokerConfigVersion, BrokerConfigDiffResult, BrokerConfigDiffLine, BrokerOperation, BrokerBackup, BrokerConfigRawResult } from '../../../types/mqtt';

/** Hash kecil (djb2) untuk checksum demo — bukan checksum server. */
function demoChecksum(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return `demo-${h.toString(16)}`;
}

/**
 * E23 Batch 1 (FAT-182, N-13): diff baris sederhana (prefix/suffix sama +
 * tengah sebagai remove/add) antara konfigurasi aktif (base) dan versi.
 */
function configDiffLines(base: BrokerConfigSchema, version: BrokerConfigSchema): BrokerConfigDiffLine[] {
  const a = JSON.stringify(base, null, 2).split('\n');
  const b = JSON.stringify(version, null, 2).split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const lines: BrokerConfigDiffLine[] = [];
  for (let i = 0; i < start; i++) lines.push({ type: 'context', oldLine: i + 1, newLine: i + 1, text: a[i] });
  for (let i = start; i <= endA; i++) lines.push({ type: 'remove', oldLine: i + 1, newLine: null, text: a[i] });
  for (let i = start; i <= endB; i++) lines.push({ type: 'add', oldLine: null, newLine: i + 1, text: b[i] });
  for (let i = endA + 1; i < a.length; i++) lines.push({ type: 'context', oldLine: i + 1, newLine: i + 1, text: a[i] });
  return lines;
}
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

  // E23 Batch 3 (FAT-199, N-30): raw = {text, metadata} (spec live) —
  // demo tidak punya sumber metadata → metadata null, teks tetap isi
  // mosquitto.conf hasil seed.
  async getBrokerConfigRaw(signal?: AbortSignal): Promise<BrokerConfigRawResult> {
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
    const text = [
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
    return { text, metadata: null };
  },

  // E23 Batch 1 (FAT-179, N-10): bentuk spec live
  // `{runtime, lock, current, lastOperation, lastAppliedVersionId}`.
  async getBrokerConfigStatus(signal?: AbortSignal): Promise<BrokerConfigStatus> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_STATUS', ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath());
    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    return {
      runtime: {
        mode: 'helper',
        available: true,
        validation: { available: true },
        reload: { available: true },
        restart: { available: true },
        apply: { available: true },
      },
      lock: { held: false, stale: false },
      current: activeVer
        ? { checksum: `demo-${activeVer.version_id}`, sizeBytes: 2910, modifiedAt: activeVer.applied_at }
        : null,
      lastOperation: null,
      lastAppliedVersionId: activeVer?.version_id ?? null,
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

  // E23 Batch 1 (FAT-182, N-13): bentuk spec live
  // `{baseVersionId, versionId, baseChecksum, checksum, truncated, lines[]}`.
  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<BrokerConfigDiffResult> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false, resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_DIFF', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId));
    const v = store.configVersions.find((ver) => ver.version_id === versionId);
    if (!v) throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });

    const baseText = JSON.stringify(store.brokerConfig, null, 2);
    const versionText = JSON.stringify(v.config, null, 2);
    return {
      version_id: versionId,
      baseVersionId: v.parent_version_id ?? null,
      versionId,
      baseChecksum: demoChecksum(baseText),
      checksum: demoChecksum(versionText),
      truncated: false,
      lines: configDiffLines(store.brokerConfig, v.config),
    };
  },

  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertCapability('mqtt.config.manage', ['ADMIN']);
    store.recordEndpoint('MQTT_CONFIG_STAGE', ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath());

    const issues: Array<{ field: string; message: string }> = [];
    // E20 P20.5 (FAT-157): validasi `max_connections` DIHAPUS — field
    // nullable (§3.3b); `null` = tanpa sumber, bukan pelanggaran.
    // `autosave_interval_seconds` null dijaga eksplisit: `null < 60`
    // bernilai true di JS dan akan menolak draft yang sah.
    const autosave = newConfig.general.autosave_interval_seconds;
    if (autosave !== null && autosave < 60) {
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
    // E23 Batch 1 (FAT-181, N-12): kata sandi bridge (transient, hanya
    // untuk staging) TIDAK disimpan di store demo; respons stage demo
    // menyertakan validation + impact seperti 201 spec live.
    const storedConfig: BrokerConfigSchema = JSON.parse(JSON.stringify(newConfig));
    storedConfig.bridges = (storedConfig.bridges ?? []).map((b) => {
      const { password: _password, ...rest } = b;
      return rest;
    });
    const staged: BrokerConfigVersion = {
      version_id: versionId,
      parent_version_id: activeVer?.version_id ?? null,
      applied_at: new Date().toISOString(),
      applied_by: store.currentUserName,
      summary: summary.trim() || 'Staged configuration draft via Admin Console',
      operation_type: 'RELOAD',
      status: 'STAGED',
      config: storedConfig,
      validation: {
        status: 'passed',
        checkedAt: new Date().toISOString(),
        issues: [],
        isolated: { status: 'passed' },
      },
      impact: { action: 'reload', reasons: [], changes: [] },
    };
    store.configVersions.unshift(staged);
    store.brokerOperations.unshift({
      operation_id: `op-cfg-${Date.now().toString().slice(-5)}`,
      // E20 P20.5 (FAT-157): staging = NO_OPERATION (belum ada aksi broker).
      type: 'NO_OPERATION',
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
      // E20 P20.5 (FAT-157): status versi kanonis STAGED/ACTIVE/
      // ROLLED_BACK — versi lama yang digantikan = ROLLED_BACK.
      if (v.status === 'ACTIVE') v.status = 'ROLLED_BACK';
    });
    target.status = 'ACTIVE';
    target.applied_at = new Date().toISOString();
    target.applied_by = store.currentUserName;
    store.brokerConfig = JSON.parse(JSON.stringify(target.config));

    const operation: BrokerOperation = {
      operation_id: `op-apply-${Date.now().toString().slice(-5)}`,
      // E20 P20.5 (FAT-157): apply = RELOAD (operation_type kanonis).
      type: 'RELOAD',
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
      // E20 P20.5 (FAT-157): rollback = RELOAD (operation_type kanonis).
      type: 'RELOAD',
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
