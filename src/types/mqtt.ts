export interface MqttClient {
  username: string;
  clientid?: string;
  textname?: string;
  textdescription?: string;
  enabled: boolean;
  roles: string[];
  groups: string[];
  created_at?: string;
  last_seen?: string;
}

export interface MqttRole {
  rolename: string;
  textname?: string;
  textdescription?: string;
  acls: MqttAcl[];
}

export type MqttAclType =
  | 'publishClientSend'
  | 'publishClientReceive'
  | 'subscribeLiteral'
  | 'subscribePattern'
  | 'unsubscribeLiteral'
  | 'unsubscribePattern';

export interface MqttAcl {
  acltype: MqttAclType;
  topic: string;
  priority?: number;
  allow: boolean;
}

export interface MqttGroup {
  groupname: string;
  textname?: string;
  textdescription?: string;
  clients: string[];
  roles: string[];
}

/**
 * E23 Batch 4 (FAT-203, N-33): bentuk `GET /api/v1/mqtt/dynamic-security/status`
 * menurut spec live — `{connected, subscribed, connecting, pluginReady,
 * brokerUrl, adminUsername, lastError, lastConnectedAt}`. Bentuk lama panel
 * (`enabled/status/clients_count/roles_count/groups_count`) tidak ada satu
 * pun field-nya di spec → selalu menghasilkan status DISCONNECTED palsu.
 */
export interface MqttDynsecStatus {
  connected: boolean;
  subscribed: boolean;
  connecting: boolean;
  pluginReady: boolean;
  brokerUrl: string;
  adminUsername: string;
  lastError: string | null;
  lastConnectedAt: string | null;
}

/**
 * E20 P20.5 (FAT-157): bentuk `GET /api/v1/mqtt/overview` (API doc §3.3a).
 * Status dynsec kanonis `"READY"` (bukan CONNECTED/DISCONNECTED); count
 * `null` berarti "tidak tersedia", bukan 0 (FR-035-51).
 * E23 Batch 3 (FAT-197, N-28): spec live — `status` enum
 * READY/CONNECTING/DISCONNECTED (bukan hardcode 'READY'); varian
 * `available=false` membawa `reason`; `configuration.lastOperation`
 * berupa OBJEK (bentuk `BrokerConfigLastOperation`)|null, bukan string.
 */
export interface BrokerOverviewInfo {
  dynamicSecurity: {
    available: boolean;
    enabled: boolean;
    status: 'READY' | 'CONNECTING' | 'DISCONNECTED';
    /** Alasan bila `available=false` (varian spec tanpa `status`). */
    reason?: string | null;
    clientsCount: number | null;
    rolesCount: number | null;
    groupsCount: number | null;
    lastError: string | null;
    measuredAt: string | null;
  };
  configuration: {
    status: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED' | 'UNAVAILABLE';
    activeVersionId: string | null;
    lastAppliedAt: string | null;
    mutationLocked: boolean;
    lastOperation: BrokerConfigLastOperation | null;
    measuredAt: string | null;
  };
}

export interface BrokerListener {
  id: string;
  port: number;
  bind_address: string;
  protocol: 'mqtt' | 'websockets';
  enabled: boolean;
  tls_enabled: boolean;
  max_connections: number;
}

export interface BrokerTlsProfile {
  id: string;
  name: string;
  certfile_ref: string;
  cafile_ref: string;
  tls_version: string;
  require_certificate: boolean;
  expires_at?: string;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface BrokerBridge {
  id: string;
  name: string;
  enabled?: boolean;
  remote_address: string;
  remote_port: number;
  /** Null bila tanpa sumber nyata (§3.3b) — bukan string kosong. */
  remote_client_id: string | null;
  remote_username?: string;
  has_password?: boolean;
  /**
   * E23 Batch 1 (FAT-181, N-12): kata sandi bridge — HANYA transient untuk
   * staging. GET tidak pernah mengembalikannya (hanya `has_password`);
   * editor mengisinya ulang saat staging bila bridge memakainya.
   */
  password?: string;
  protocol_version: 'mqttv311' | 'mqttv5';
  topics: Array<{
    pattern: string;
    direction: 'in' | 'out' | 'both';
    qos: 0 | 1 | 2;
    local_prefix?: string;
    remote_prefix?: string;
  }>;
  /** Null bila tanpa sumber nyata (§3.3b). */
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | null;
  tls_enabled: boolean;
}

/**
 * E23 Batch 3 (FAT-198, N-29): satu kunci konfigurasi di luar kendali
 * panel — spec live berupa objek `{key, section, line, reason}` (bukan
 * string; `String(u)` lama menghasilkan "[object Object]").
 */
export interface BrokerConfigUnmanagedEntry {
  key: string;
  section: string;
  line: number;
  reason: string;
}

/**
 * E20 P20.5 (FAT-157): model panel `GET /mqtt/configuration` (§3.3b).
 * Field tanpa sumber nyata = `null` (bukan default fabrikasi);
 * `tls_profiles` selalu `[]` (TLS melekat pada listener/bridge);
 * `unmanaged[]` = kunci konfigurasi di luar kendali panel.
 * E23 Batch 3 (FAT-198, N-29): `max_queued_messages` /
 * `max_inflight_messages` juga nullable (default fabrikasi 1000/20
 * dihapus — null tetap null).
 */
export interface BrokerConfigSchema {
  version: string;
  general: {
    per_listener_settings: boolean;
    allow_anonymous: boolean;
    autosave_interval_seconds: number | null;
    persistence: boolean;
    persistence_location: string;
    log_dest: string[];
    log_type: string[];
    connection_messages: boolean;
  };
  limits: {
    max_connections: number | null;
    max_packet_size_bytes: number | null;
    max_queued_messages: number | null;
    max_queued_bytes: number | null;
    max_inflight_messages: number | null;
  };
  listeners: BrokerListener[];
  tls_profiles: BrokerTlsProfile[];
  bridges: BrokerBridge[];
  unmanaged?: BrokerConfigUnmanagedEntry[];
}

/**
 * E23 Batch 1 (FAT-179, N-10): `GET /mqtt/configuration/status` — bentuk
 * spec live (menjawab AUDIT §24.1), BUKAN asumsi lama `status`/
 * `activeVersionId`/`lastAppliedAt`/`mutationLocked`/`lastOperation` string/
 * `measuredAt` top-level (tak satu pun ada di spec).
 */
export interface BrokerConfigRuntimeCapability {
  available: boolean;
  reason?: string | null;
}

export interface BrokerConfigLastOperation {
  operation_id: string;
  version_id: string;
  type: 'APPLY' | 'ROLLBACK' | 'DISCARD' | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  domainStatus: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK' | 'INTERRUPTED';
  domainAction: 'APPLY' | 'ROLLBACK' | 'RECOVERY';
  phase: string;
  actorId: string;
  actorName: string;
  reason: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: Array<{
    name: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    detail?: string;
  }>;
  error: { code: string; message: string } | null;
  result: {
    previousVersionId: string | null;
    appliedVersionId: string | null;
    rollbackAttempted: boolean;
    rollbackSucceeded: boolean;
  };
}

export interface BrokerConfigStatus {
  runtime: {
    mode: 'helper' | 'native' | 'disabled' | null;
    available: boolean;
    validation: BrokerConfigRuntimeCapability;
    reload: BrokerConfigRuntimeCapability;
    restart: BrokerConfigRuntimeCapability;
    apply: BrokerConfigRuntimeCapability;
    targetContainer?: string | null;
    targetImage?: string | null;
    lastError?: string | null;
  };
  lock: {
    held: boolean;
    stale: boolean;
    ownerPid?: number | null;
    startedAt?: string | null;
    operationId?: string | null;
  };
  current: { checksum: string; sizeBytes: number; modifiedAt: string } | null;
  lastOperation: BrokerConfigLastOperation | null;
  lastAppliedVersionId: string | null;
}

/**
 * E23 Batch 1 (FAT-181, N-12): hasil validasi + dampak + diff yang
 * disertakan respons stage 201 / GET versi — sebelumnya dibuang panel.
 */
export interface BrokerConfigValidationIssue {
  field: string;
  message: string;
  severity?: 'error' | 'warning';
  code?: string;
}

export interface BrokerConfigValidation {
  status: 'passed' | 'failed' | 'skipped';
  checkedAt?: string;
  issues: BrokerConfigValidationIssue[];
  isolated?: {
    status: 'passed' | 'failed' | 'skipped';
    message?: string | null;
    exitCode?: number | null;
    durationMs?: number;
    output?: string;
  } | null;
}

export interface BrokerConfigImpact {
  action: 'none' | 'reload' | 'restart';
  reasons: string[];
  changes: Array<{ scope: string; key: string; operation: 'add' | 'remove' | 'change' }>;
}

/** E23 Batch 1 (FAT-182, N-13): satu baris diff konfigurasi (spec live). */
export interface BrokerConfigDiffLine {
  type: 'context' | 'add' | 'remove';
  oldLine?: number | null;
  newLine?: number | null;
  text: string;
}

export interface BrokerConfigDiff {
  baseVersionId: string | null;
  versionId: string | null;
  baseChecksum: string | null;
  checksum: string;
  truncated: boolean;
  lines: BrokerConfigDiffLine[];
}

/** Hasil `GET /configurations/{versionId}/diff` (spec live) + alias panel. */
export interface BrokerConfigDiffResult extends BrokerConfigDiff {
  version_id: string;
}

export interface BrokerConfigVersion {
  version_id: string;
  parent_version_id?: string | null;
  applied_at: string;
  applied_by: string;
  summary: string;
  operation_type: 'RELOAD' | 'RESTART' | 'NO_OPERATION';
  /** Status versi panel: hanya STAGED/ACTIVE/ROLLED_BACK (§3.3b). */
  status: 'STAGED' | 'ACTIVE' | 'ROLLED_BACK';
  /** Nilai domain asli bila status panel memetakannya (mis. 'APPLIED' lama). */
  domainStatus?: string | null;
  config: BrokerConfigSchema;
  /** E23 Batch 1 (FAT-181, N-12): dari respons stage 201 / GET versi. */
  validation?: BrokerConfigValidation;
  impact?: BrokerConfigImpact;
  diff?: BrokerConfigDiff;
}

export interface BrokerOperationStep {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  message?: string;
  /** E23 Batch 3 (FAT-200, N-31): dari `steps[]` spec live. */
  startedAt?: string | null;
  finishedAt?: string | null;
  detail?: string;
}

export interface BrokerOperation {
  operation_id: string;
  /**
   * E20 P20.5 (FAT-157): `operation_type` kanonis (§3.3b) —
   * NO_OPERATION/RELOAD/RESTART; `null` untuk aksi RECOVERY.
   * E23 Batch 3 (FAT-200, N-31): spec live `GET /operations[/:id]`
   * memakai `type` APPLY/ROLLBACK/DISCARD|null — nilai itu dipetakan
   * apa adanya (bukan lagi dipaksa ke 'RELOAD'); nilai legacy
   * `operation_type` tetap diterima sebagai fallback.
   */
  type: 'NO_OPERATION' | 'RELOAD' | 'RESTART' | 'APPLY' | 'ROLLBACK' | 'DISCARD' | null;
  version_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  reason?: string;
  steps?: BrokerOperationStep[];
  /**
   * E23 Batch 3 (FAT-200, N-31): spec TIDAK punya `timestamp`/
   * `created_at` — sumber kanonis adalah `startedAt` ('' bila absen,
   * BUKAN epoch 1970); `completed_at` ← `finishedAt`.
   */
  timestamp: string;
  completed_at?: string | null;
  /** E23 Batch 3 (FAT-200, N-31): field spec yang dulu dibuang mapper. */
  domainStatus?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK' | 'INTERRUPTED' | null;
  domainAction?: 'APPLY' | 'ROLLBACK' | 'RECOVERY' | null;
  phase?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: { code: string; message: string } | null;
  result?: {
    previousVersionId: string | null;
    appliedVersionId: string | null;
    rollbackAttempted: boolean;
    rollbackSucceeded: boolean;
  } | null;
}

/**
 * E23 Batch 3 (FAT-199, N-30): hasil `GET /mqtt/configuration/raw` —
 * spec live `{metadata:{source, checksum, sizeBytes, modifiedAt,
 * mosquittoVersion}, text}`. `text` adalah isi mosquitto.conf (bukan
 * dokumen JSON utuh); `metadata` null bila server mengembalikan teks
 * polos (bentuk lama) atau demo.
 */
export interface BrokerConfigRawResult {
  text: string;
  metadata: {
    source: string;
    checksum: string;
    sizeBytes: number;
    modifiedAt: string;
    mosquittoVersion: string;
  } | null;
}

export interface BrokerBackup {
  backup_id: string;
  filename: string;
  version_id: string;
  created_at: string;
  size_bytes: number;
}
