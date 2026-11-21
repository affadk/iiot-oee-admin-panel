/**
 * Tipe MQTT — Dynamic Security (klien, role, ACL, grup, status dynsec).
 *
 * Dipisah dari types/mqtt.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file type = satu domain). Barrel penggabung: types/mqtt.ts.
 */
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
