/**
 * Registry endpoint — domain mqtt.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const MQTT_ENDPOINTS: Record<string, EndpointDefinition> = {
MQTT_OVERVIEW: {
    key: 'MQTT_OVERVIEW',
    method: 'GET',
    template: '/api/v1/mqtt/overview',
    buildPath: () => '/api/v1/mqtt/overview',
  },

MQTT_DYNSEC_STATUS: {
    key: 'MQTT_DYNSEC_STATUS',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/status',
    buildPath: () => '/api/v1/mqtt/dynamic-security/status',
  },

MQTT_DYNSEC_CLIENTS_LIST: {
    key: 'MQTT_DYNSEC_CLIENTS_LIST',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/clients',
    buildPath: () => '/api/v1/mqtt/dynamic-security/clients',
  },

MQTT_DYNSEC_CLIENTS_GET: {
    key: 'MQTT_DYNSEC_CLIENTS_GET',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/clients/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/clients/${enc(name)}`,
  },

MQTT_DYNSEC_CLIENTS_CREATE: {
    key: 'MQTT_DYNSEC_CLIENTS_CREATE',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/clients',
    buildPath: () => '/api/v1/mqtt/dynamic-security/clients',
  },

  // E20 P20.2 (X1/R23, K-11): MQTT_DYNSEC_CLIENTS_PROVISION DIHAPUS — digantikan
  // POST /api/v1/devices/provision (§E.3a). Jangan kembalikan rute ini; §M yang
  // masih mendokumentasikannya adalah sisa lama (D-11).

MQTT_DYNSEC_CLIENTS_DELETE: {
    key: 'MQTT_DYNSEC_CLIENTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/clients/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/clients/${enc(name)}`,
  },

MQTT_DYNSEC_CLIENTS_PASSWORD: {
    key: 'MQTT_DYNSEC_CLIENTS_PASSWORD',
    method: 'PATCH',
    template: '/api/v1/mqtt/dynamic-security/clients/:name/password',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/clients/${enc(name)}/password`,
  },

MQTT_DYNSEC_CLIENTS_ENABLE: {
    key: 'MQTT_DYNSEC_CLIENTS_ENABLE',
    method: 'PATCH',
    template: '/api/v1/mqtt/dynamic-security/clients/:name/enable',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/clients/${enc(name)}/enable`,
  },

MQTT_DYNSEC_CLIENT_ROLES_ADD: {
    key: 'MQTT_DYNSEC_CLIENT_ROLES_ADD',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/clients/:name/roles',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/clients/${enc(name)}/roles`,
  },

MQTT_DYNSEC_CLIENT_ROLES_DELETE: {
    key: 'MQTT_DYNSEC_CLIENT_ROLES_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/clients/:name/roles/:rolename',
    buildPath: (name: string, rolename: string) =>
      `/api/v1/mqtt/dynamic-security/clients/${enc(name)}/roles/${enc(rolename)}`,
  },

MQTT_DYNSEC_ROLES_LIST: {
    key: 'MQTT_DYNSEC_ROLES_LIST',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/roles',
    buildPath: () => '/api/v1/mqtt/dynamic-security/roles',
  },

MQTT_DYNSEC_ROLES_GET: {
    key: 'MQTT_DYNSEC_ROLES_GET',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/roles/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/roles/${enc(name)}`,
  },

MQTT_DYNSEC_ROLES_CREATE: {
    key: 'MQTT_DYNSEC_ROLES_CREATE',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/roles',
    buildPath: () => '/api/v1/mqtt/dynamic-security/roles',
  },

MQTT_DYNSEC_ROLES_DELETE: {
    key: 'MQTT_DYNSEC_ROLES_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/roles/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/roles/${enc(name)}`,
  },

MQTT_DYNSEC_ROLE_ACLS_ADD: {
    key: 'MQTT_DYNSEC_ROLE_ACLS_ADD',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/roles/:name/acls',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/roles/${enc(name)}/acls`,
  },

MQTT_DYNSEC_ROLE_ACLS_DELETE: {
    key: 'MQTT_DYNSEC_ROLE_ACLS_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/roles/:name/acls',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/roles/${enc(name)}/acls`,
  },

MQTT_DYNSEC_GROUPS_LIST: {
    key: 'MQTT_DYNSEC_GROUPS_LIST',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/groups',
    buildPath: () => '/api/v1/mqtt/dynamic-security/groups',
  },

MQTT_DYNSEC_GROUPS_GET: {
    key: 'MQTT_DYNSEC_GROUPS_GET',
    method: 'GET',
    template: '/api/v1/mqtt/dynamic-security/groups/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/groups/${enc(name)}`,
  },

MQTT_DYNSEC_GROUPS_CREATE: {
    key: 'MQTT_DYNSEC_GROUPS_CREATE',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/groups',
    buildPath: () => '/api/v1/mqtt/dynamic-security/groups',
  },

MQTT_DYNSEC_GROUPS_DELETE: {
    key: 'MQTT_DYNSEC_GROUPS_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/groups/:name',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/groups/${enc(name)}`,
  },

MQTT_DYNSEC_GROUP_CLIENTS_ADD: {
    key: 'MQTT_DYNSEC_GROUP_CLIENTS_ADD',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/groups/:name/clients',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/groups/${enc(name)}/clients`,
  },

MQTT_DYNSEC_GROUP_CLIENTS_DELETE: {
    key: 'MQTT_DYNSEC_GROUP_CLIENTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/groups/:name/clients/:username',
    buildPath: (name: string, username: string) =>
      `/api/v1/mqtt/dynamic-security/groups/${enc(name)}/clients/${enc(username)}`,
  },

MQTT_DYNSEC_GROUP_ROLES_ADD: {
    key: 'MQTT_DYNSEC_GROUP_ROLES_ADD',
    method: 'POST',
    template: '/api/v1/mqtt/dynamic-security/groups/:name/roles',
    buildPath: (name: string) => `/api/v1/mqtt/dynamic-security/groups/${enc(name)}/roles`,
  },

MQTT_DYNSEC_GROUP_ROLES_DELETE: {
    key: 'MQTT_DYNSEC_GROUP_ROLES_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/dynamic-security/groups/:name/roles/:rolename',
    buildPath: (name: string, rolename: string) =>
      `/api/v1/mqtt/dynamic-security/groups/${enc(name)}/roles/${enc(rolename)}`,
  },

MQTT_CONFIG_GET: {
    key: 'MQTT_CONFIG_GET',
    method: 'GET',
    // E23 Batch 4 (FAT-208, N-39): hapus trailing slash — spec live
    // /api/v1/mqtt/configuration (tanpa slash akhir).
    template: '/api/v1/mqtt/configuration',
    buildPath: () => '/api/v1/mqtt/configuration',
  },

MQTT_CONFIG_RAW: {
    key: 'MQTT_CONFIG_RAW',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/raw',
    buildPath: () => '/api/v1/mqtt/configuration/raw',
  },

MQTT_CONFIG_STATUS: {
    key: 'MQTT_CONFIG_STATUS',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/status',
    buildPath: () => '/api/v1/mqtt/configuration/status',
  },

MQTT_CONFIG_STAGE: {
    key: 'MQTT_CONFIG_STAGE',
    method: 'POST',
    template: '/api/v1/mqtt/configuration/configurations',
    buildPath: () => '/api/v1/mqtt/configuration/configurations',
  },

MQTT_CONFIG_LIST: {
    key: 'MQTT_CONFIG_LIST',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/configurations',
    buildPath: () => '/api/v1/mqtt/configuration/configurations',
  },

MQTT_CONFIG_VERSION_GET: {
    key: 'MQTT_CONFIG_VERSION_GET',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/configurations/:versionId',
    buildPath: (versionId: string) => `/api/v1/mqtt/configuration/configurations/${enc(versionId)}`,
  },

MQTT_CONFIG_VERSION_DIFF: {
    key: 'MQTT_CONFIG_VERSION_DIFF',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/configurations/:versionId/diff',
    buildPath: (versionId: string) =>
      `/api/v1/mqtt/configuration/configurations/${enc(versionId)}/diff`,
  },

MQTT_CONFIG_VERSION_DELETE: {
    key: 'MQTT_CONFIG_VERSION_DELETE',
    method: 'DELETE',
    template: '/api/v1/mqtt/configuration/configurations/:versionId',
    buildPath: (versionId: string) => `/api/v1/mqtt/configuration/configurations/${enc(versionId)}`,
  },

MQTT_CONFIG_VERSION_APPLY: {
    key: 'MQTT_CONFIG_VERSION_APPLY',
    method: 'POST',
    template: '/api/v1/mqtt/configuration/configurations/:versionId/apply',
    buildPath: (versionId: string) =>
      `/api/v1/mqtt/configuration/configurations/${enc(versionId)}/apply`,
  },

MQTT_CONFIG_VERSION_ROLLBACK: {
    key: 'MQTT_CONFIG_VERSION_ROLLBACK',
    method: 'POST',
    template: '/api/v1/mqtt/configuration/configurations/:versionId/rollback',
    buildPath: (versionId: string) =>
      `/api/v1/mqtt/configuration/configurations/${enc(versionId)}/rollback`,
  },

MQTT_CONFIG_OPERATIONS: {
    key: 'MQTT_CONFIG_OPERATIONS',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/operations',
    buildPath: () => '/api/v1/mqtt/configuration/operations',
  },

MQTT_CONFIG_OPERATION_GET: {
    key: 'MQTT_CONFIG_OPERATION_GET',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/operations/:operationId',
    buildPath: (operationId: string) => `/api/v1/mqtt/configuration/operations/${enc(operationId)}`,
  },

MQTT_CONFIG_BACKUPS: {
    key: 'MQTT_CONFIG_BACKUPS',
    method: 'GET',
    template: '/api/v1/mqtt/configuration/backups',
    buildPath: () => '/api/v1/mqtt/configuration/backups',
  },
};
