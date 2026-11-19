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
 * E20 P20.5 (FAT-157): bentuk `GET /api/v1/mqtt/overview` (API doc §3.3a).
 * Status dynsec kanonis `"READY"` (bukan CONNECTED/DISCONNECTED); count
 * `null` berarti "tidak tersedia", bukan 0 (FR-035-51).
 */
export interface BrokerOverviewInfo {
  dynamicSecurity: {
    available: boolean;
    enabled: boolean;
    status: 'READY';
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
    lastOperation: string | null;
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
 * E20 P20.5 (FAT-157): model panel `GET /mqtt/configuration` (§3.3b).
 * Field tanpa sumber nyata = `null` (bukan default fabrikasi);
 * `tls_profiles` selalu `[]` (TLS melekat pada listener/bridge);
 * `unmanaged[]` = kunci konfigurasi di luar kendali panel.
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
    max_queued_messages: number;
    max_queued_bytes: number | null;
    max_inflight_messages: number;
  };
  listeners: BrokerListener[];
  tls_profiles: BrokerTlsProfile[];
  bridges: BrokerBridge[];
  unmanaged?: string[];
}

/**
 * E20 P20.5 (FAT-157): `GET /mqtt/configuration/status` (§3.3b) — bentuk
 * dokumen (runtime + mutation lock + operasi terakhir), BUKAN asumsi panel
 * `active_version`/`sync_state`.
 */
export interface BrokerConfigStatus {
  status: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED' | 'UNAVAILABLE';
  activeVersionId: string | null;
  lastAppliedAt: string | null;
  mutationLocked: boolean;
  lastOperation: string | null;
  measuredAt: string | null;
  runtime?: {
    mode?: string | null;
    apply?: { available?: boolean };
  };
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
}

export interface BrokerOperationStep {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  message?: string;
}

export interface BrokerOperation {
  operation_id: string;
  /**
   * E20 P20.5 (FAT-157): `operation_type` kanonis (§3.3b) —
   * NO_OPERATION/RELOAD/RESTART; `null` untuk aksi RECOVERY.
   */
  type: 'NO_OPERATION' | 'RELOAD' | 'RESTART' | null;
  version_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  reason?: string;
  steps?: BrokerOperationStep[];
  timestamp: string;
  completed_at?: string | null;
}

export interface BrokerBackup {
  backup_id: string;
  filename: string;
  version_id: string;
  created_at: string;
  size_bytes: number;
}
