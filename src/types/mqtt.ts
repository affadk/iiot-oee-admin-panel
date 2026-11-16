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

export interface BrokerOverviewInfo {
  dynamicSecurity: {
    enabled: boolean;
    status: 'CONNECTED' | 'DISCONNECTED';
    clientsCount: number;
    rolesCount: number;
    groupsCount: number;
  };
  configuration: {
    status: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
    activeVersionId: string | null;
    lastAppliedAt: string | null;
    mutationLocked: boolean;
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
  remote_address: string;
  remote_port: number;
  remote_client_id: string;
  protocol_version: 'mqttv311' | 'mqttv5';
  topics: Array<{
    pattern: string;
    direction: 'in' | 'out' | 'both';
    qos: 0 | 1 | 2;
    local_prefix?: string;
    remote_prefix?: string;
  }>;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  tls_enabled: boolean;
}

export interface BrokerConfigSchema {
  version: string;
  general: {
    per_listener_settings: boolean;
    allow_anonymous: boolean;
    autosave_interval_seconds: number;
    persistence: boolean;
    persistence_location: string;
    log_dest: string[];
    log_type: string[];
    connection_messages: boolean;
  };
  limits: {
    max_connections: number;
    max_packet_size_bytes: number;
    max_queued_messages: number;
    max_queued_bytes: number;
    max_inflight_messages: number;
  };
  listeners: BrokerListener[];
  tls_profiles: BrokerTlsProfile[];
  bridges: BrokerBridge[];
}

export interface BrokerConfigVersion {
  version_id: string;
  parent_version_id?: string | null;
  applied_at: string;
  applied_by: string;
  summary: string;
  operation_type: 'RELOAD' | 'RESTART' | 'NO_OPERATION';
  status: 'STAGED' | 'APPLIED' | 'ACTIVE' | 'ROLLED_BACK';
  config: BrokerConfigSchema;
}

export interface BrokerOperationStep {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  message?: string;
}

export interface BrokerOperation {
  operation_id: string;
  type: 'STAGE' | 'APPLY' | 'ROLLBACK' | 'DISCARD';
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
