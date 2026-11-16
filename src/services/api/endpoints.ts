/**
 * Authoritative Admin Panel Endpoint Catalog
 * Matches ADMIN_PANEL_BUILD_GUIDE.md Lampiran A (131 Admin REST candidates + 1 WebSocket = 132)
 * and API_DOCUMENTATION.md.
 *
 * Strictly EXCLUDES HMI-only flows:
 * - POST /api/v1/devices/:device_id/command (ADR-003 machine actuation)
 * - POST /api/v1/work-orders/validate-zone
 * - POST /api/v1/work-orders/initiate-from-zones
 * - POST /api/v1/work-orders/:wo_id/dispatch
 * - POST /api/v1/work-orders/:wo_id/complete
 * And strictly blocks legacy/non-existent paths:
 * - POST /api/v1/mqtt/dynamic-security/clients/provision
 * - POST /api/v1/mqtt/dynamic-security/provision
 * - POST /api/v1/auth/operator-pin
 * - /api/v1/mqtt/configuration/versions
 */

export interface EndpointDefinition {
  key: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS';
  template: string;
  buildPath: (...args: string[]) => string;
}

const enc = (val: string) => encodeURIComponent(val);

export const ADMIN_ENDPOINTS = {
  // Health & WebSocket (ONLY routes without /api/v1 prefix)
  HEALTH: {
    key: 'HEALTH',
    method: 'GET',
    template: '/health',
    buildPath: () => '/health',
  },
  WS_TELEMETRY: {
    key: 'WS_TELEMETRY',
    method: 'WS',
    template: '/ws/telemetry',
    buildPath: () => '/ws/telemetry',
  },

  // Authentication
  AUTH_LOGIN: {
    key: 'AUTH_LOGIN',
    method: 'POST',
    template: '/api/v1/auth/login',
    buildPath: () => '/api/v1/auth/login',
  },
  AUTH_REFRESH: {
    key: 'AUTH_REFRESH',
    method: 'POST',
    template: '/api/v1/auth/refresh',
    buildPath: () => '/api/v1/auth/refresh',
  },
  AUTH_CHANGE_PASSWORD: {
    key: 'AUTH_CHANGE_PASSWORD',
    method: 'POST',
    template: '/api/v1/auth/password/change',
    buildPath: () => '/api/v1/auth/password/change',
  },
  AUTH_ME: {
    key: 'AUTH_ME',
    method: 'GET',
    template: '/api/v1/auth/me',
    buildPath: () => '/api/v1/auth/me',
  },

  // Devices (6 ops — command is HMI-only and strictly forbidden here)
  DEVICES_LIST: {
    key: 'DEVICES_LIST',
    method: 'GET',
    template: '/api/v1/devices',
    buildPath: () => '/api/v1/devices',
  },
  DEVICES_GET: {
    key: 'DEVICES_GET',
    method: 'GET',
    template: '/api/v1/devices/:deviceId',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}`,
  },
  DEVICES_HEALTH: {
    key: 'DEVICES_HEALTH',
    method: 'GET',
    template: '/api/v1/devices/:deviceId/health',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}/health`,
  },
  DEVICES_CREATE: {
    key: 'DEVICES_CREATE',
    method: 'POST',
    template: '/api/v1/devices',
    buildPath: () => '/api/v1/devices',
  },
  DEVICES_UPDATE: {
    key: 'DEVICES_UPDATE',
    method: 'PUT',
    template: '/api/v1/devices/:deviceId',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}`,
  },
  DEVICES_DELETE: {
    key: 'DEVICES_DELETE',
    method: 'DELETE',
    template: '/api/v1/devices/:deviceId',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}`,
  },

  // Machines (7 ops)
  MACHINES_LIST: {
    key: 'MACHINES_LIST',
    method: 'GET',
    template: '/api/v1/machines',
    buildPath: () => '/api/v1/machines',
  },
  MACHINES_GET: {
    key: 'MACHINES_GET',
    method: 'GET',
    template: '/api/v1/machines/:machineId',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}`,
  },
  MACHINES_CREATE: {
    key: 'MACHINES_CREATE',
    method: 'POST',
    template: '/api/v1/machines',
    buildPath: () => '/api/v1/machines',
  },
  MACHINES_UPDATE: {
    key: 'MACHINES_UPDATE',
    method: 'PUT',
    template: '/api/v1/machines/:machineId',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}`,
  },
  MACHINES_DELETE: {
    key: 'MACHINES_DELETE',
    method: 'DELETE',
    template: '/api/v1/machines/:machineId',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}`,
  },
  MACHINES_BIND: {
    key: 'MACHINES_BIND',
    method: 'POST',
    template: '/api/v1/machines/:machineId/bind',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}/bind`,
  },
  MACHINES_UNBIND: {
    key: 'MACHINES_UNBIND',
    method: 'POST',
    template: '/api/v1/machines/:machineId/unbind',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}/unbind`,
  },
  MACHINES_STATUS_HISTORY: {
    key: 'MACHINES_STATUS_HISTORY',
    method: 'GET',
    template: '/api/v1/machines/:machineId/status-history',
    buildPath: (id: string) => `/api/v1/machines/${enc(id)}/status-history`,
  },

  // Production Lines (5 ops - Spec 028)
  PRODUCTION_LINES_LIST: {
    key: 'PRODUCTION_LINES_LIST',
    method: 'GET',
    template: '/api/v1/production-lines',
    buildPath: () => '/api/v1/production-lines',
  },
  PRODUCTION_LINES_GET: {
    key: 'PRODUCTION_LINES_GET',
    method: 'GET',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },
  PRODUCTION_LINES_CREATE: {
    key: 'PRODUCTION_LINES_CREATE',
    method: 'POST',
    template: '/api/v1/production-lines',
    buildPath: () => '/api/v1/production-lines',
  },
  PRODUCTION_LINES_UPDATE: {
    key: 'PRODUCTION_LINES_UPDATE',
    method: 'PATCH',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },
  PRODUCTION_LINES_DELETE: {
    key: 'PRODUCTION_LINES_DELETE',
    method: 'DELETE',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },

  // Shifts (5 ops - Spec 028)
  SHIFTS_LIST: {
    key: 'SHIFTS_LIST',
    method: 'GET',
    template: '/api/v1/shifts',
    buildPath: () => '/api/v1/shifts',
  },
  SHIFTS_GET: {
    key: 'SHIFTS_GET',
    method: 'GET',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },
  SHIFTS_CREATE: {
    key: 'SHIFTS_CREATE',
    method: 'POST',
    template: '/api/v1/shifts',
    buildPath: () => '/api/v1/shifts',
  },
  SHIFTS_UPDATE: {
    key: 'SHIFTS_UPDATE',
    method: 'PATCH',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },
  SHIFTS_DELETE: {
    key: 'SHIFTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },

  // Shift Schedules (5 ops - Spec 028)
  SHIFT_SCHEDULES_LIST: {
    key: 'SHIFT_SCHEDULES_LIST',
    method: 'GET',
    template: '/api/v1/shift-schedules',
    buildPath: () => '/api/v1/shift-schedules',
  },
  SHIFT_SCHEDULES_GET: {
    key: 'SHIFT_SCHEDULES_GET',
    method: 'GET',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },
  SHIFT_SCHEDULES_CREATE: {
    key: 'SHIFT_SCHEDULES_CREATE',
    method: 'POST',
    template: '/api/v1/shift-schedules',
    buildPath: () => '/api/v1/shift-schedules',
  },
  SHIFT_SCHEDULES_UPDATE: {
    key: 'SHIFT_SCHEDULES_UPDATE',
    method: 'PATCH',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },
  SHIFT_SCHEDULES_DELETE: {
    key: 'SHIFT_SCHEDULES_DELETE',
    method: 'DELETE',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },

  // Products (5 ops)
  PRODUCTS_LIST: {
    key: 'PRODUCTS_LIST',
    method: 'GET',
    template: '/api/v1/products',
    buildPath: () => '/api/v1/products',
  },
  PRODUCTS_GET: {
    key: 'PRODUCTS_GET',
    method: 'GET',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },
  PRODUCTS_CREATE: {
    key: 'PRODUCTS_CREATE',
    method: 'POST',
    template: '/api/v1/products',
    buildPath: () => '/api/v1/products',
  },
  PRODUCTS_UPDATE: {
    key: 'PRODUCTS_UPDATE',
    method: 'PUT',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },
  PRODUCTS_DELETE: {
    key: 'PRODUCTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },

  // Operators (7 ops)
  OPERATORS_LIST: {
    key: 'OPERATORS_LIST',
    method: 'GET',
    template: '/api/v1/operators',
    buildPath: () => '/api/v1/operators',
  },
  OPERATORS_GET: {
    key: 'OPERATORS_GET',
    method: 'GET',
    template: '/api/v1/operators/:id',
    buildPath: (id: string) => `/api/v1/operators/${enc(id)}`,
  },
  OPERATORS_CREATE: {
    key: 'OPERATORS_CREATE',
    method: 'POST',
    template: '/api/v1/operators',
    buildPath: () => '/api/v1/operators',
  },
  OPERATORS_UPDATE: {
    key: 'OPERATORS_UPDATE',
    method: 'PUT',
    template: '/api/v1/operators/:id',
    buildPath: (id: string) => `/api/v1/operators/${enc(id)}`,
  },
  OPERATORS_DELETE: {
    key: 'OPERATORS_DELETE',
    method: 'DELETE',
    template: '/api/v1/operators/:id',
    buildPath: (id: string) => `/api/v1/operators/${enc(id)}`,
  },
  OPERATORS_PASSWORD: {
    key: 'OPERATORS_PASSWORD',
    method: 'PATCH',
    template: '/api/v1/operators/:id/password',
    buildPath: (id: string) => `/api/v1/operators/${enc(id)}/password`,
  },
  OPERATORS_STATUS: {
    key: 'OPERATORS_STATUS',
    method: 'PATCH',
    template: '/api/v1/operators/:id/status',
    buildPath: (id: string) => `/api/v1/operators/${enc(id)}/status`,
  },

  // Work Orders (4 Admin Panel ops: read list, detail, resolve preview, ADMIN+LAN cancel)
  WORK_ORDERS_LIST: {
    key: 'WORK_ORDERS_LIST',
    method: 'GET',
    template: '/api/v1/work-orders',
    buildPath: () => '/api/v1/work-orders',
  },
  WORK_ORDERS_GET: {
    key: 'WORK_ORDERS_GET',
    method: 'GET',
    template: '/api/v1/work-orders/:wo_id',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}`,
  },
  WORK_ORDERS_RESOLVE: {
    key: 'WORK_ORDERS_RESOLVE',
    method: 'GET',
    template: '/api/v1/work-orders/:wo_id/resolve',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}/resolve`,
  },
  WORK_ORDERS_CANCEL: {
    key: 'WORK_ORDERS_CANCEL',
    method: 'POST',
    template: '/api/v1/work-orders/:wo_id/cancel',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}/cancel`,
  },

  // Live State (2 ops)
  LIVE_STATE: {
    key: 'LIVE_STATE',
    method: 'GET',
    template: '/api/v1/live-state',
    buildPath: () => '/api/v1/live-state',
  },
  LIVE_STATE_BY_DEVICE: {
    key: 'LIVE_STATE_BY_DEVICE',
    method: 'GET',
    template: '/api/v1/live-state/:deviceId',
    buildPath: (deviceId: string) => `/api/v1/live-state/${enc(deviceId)}`,
  },

  // Downtime Events (4 ops)
  DOWNTIME_ACTIVE: {
    key: 'DOWNTIME_ACTIVE',
    method: 'GET',
    template: '/api/v1/downtime-events/active',
    buildPath: () => '/api/v1/downtime-events/active',
  },
  DOWNTIME_BY_DEVICE: {
    key: 'DOWNTIME_BY_DEVICE',
    method: 'GET',
    template: '/api/v1/downtime-events/:device_id',
    buildPath: (deviceId: string) => `/api/v1/downtime-events/${enc(deviceId)}`,
  },
  DOWNTIME_DEVICE_EXPORT: {
    key: 'DOWNTIME_DEVICE_EXPORT',
    method: 'GET',
    template: '/api/v1/downtime-events/:device_id/export',
    buildPath: (deviceId: string) => `/api/v1/downtime-events/${enc(deviceId)}/export`,
  },
  DOWNTIME_REASON: {
    key: 'DOWNTIME_REASON',
    method: 'POST',
    template: '/api/v1/downtime-events/:id/reason',
    buildPath: (id: string) => `/api/v1/downtime-events/${enc(id)}/reason`,
  },

  // Operational Events & System Audit (6 ops)
  OPERATIONAL_EVENTS_LIST: {
    key: 'OPERATIONAL_EVENTS_LIST',
    method: 'GET',
    // Guide §6.7: trailing slash WAJIB untuk endpoint list ini.
    template: '/api/v1/operational-events/',
    buildPath: () => '/api/v1/operational-events/',
  },
  OPERATIONAL_EVENTS_BY_DEVICE: {
    key: 'OPERATIONAL_EVENTS_BY_DEVICE',
    method: 'GET',
    template: '/api/v1/operational-events/:deviceId',
    buildPath: (deviceId: string) => `/api/v1/operational-events/${enc(deviceId)}`,
  },
  OPERATIONAL_EVENTS_EXPORT: {
    key: 'OPERATIONAL_EVENTS_EXPORT',
    method: 'GET',
    template: '/api/v1/operational-events/export',
    buildPath: () => '/api/v1/operational-events/export',
  },
  OPERATIONAL_EVENTS_DEVICE_EXPORT: {
    key: 'OPERATIONAL_EVENTS_DEVICE_EXPORT',
    method: 'GET',
    template: '/api/v1/operational-events/:deviceId/export',
    buildPath: (deviceId: string) => `/api/v1/operational-events/${enc(deviceId)}/export`,
  },
  OPERATIONAL_EVENTS_ACK: {
    key: 'OPERATIONAL_EVENTS_ACK',
    method: 'PATCH',
    template: '/api/v1/operational-events/:id/ack',
    buildPath: (id: string) => `/api/v1/operational-events/${enc(id)}/ack`,
  },
  SYSTEM_AUDIT: {
    key: 'SYSTEM_AUDIT',
    method: 'GET',
    template: '/api/v1/system/audit',
    buildPath: () => '/api/v1/system/audit',
  },

  // Telemetry, OEE, Quality, Reconciliation (12 ops)
  TELEMETRY_HISTORY: {
    key: 'TELEMETRY_HISTORY',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}`,
  },
  TELEMETRY_HOURLY: {
    key: 'TELEMETRY_HOURLY',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/hourly',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/hourly`,
  },
  TELEMETRY_AGGREGATE: {
    key: 'TELEMETRY_AGGREGATE',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/aggregate',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/aggregate`,
  },
  TELEMETRY_ROLLUP: {
    key: 'TELEMETRY_ROLLUP',
    method: 'GET',
    template: '/api/v1/telemetry/rollup',
    buildPath: () => '/api/v1/telemetry/rollup',
  },
  TELEMETRY_EXPORT: {
    key: 'TELEMETRY_EXPORT',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/export',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/export`,
  },
  TELEMETRY_HOURLY_EXPORT: {
    key: 'TELEMETRY_HOURLY_EXPORT',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/hourly/export',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/hourly/export`,
  },
  RECONCILIATION_JOBS: {
    key: 'RECONCILIATION_JOBS',
    method: 'GET',
    template: '/api/v1/telemetry/reconciliation/jobs',
    buildPath: () => '/api/v1/telemetry/reconciliation/jobs',
  },
  RECONCILIATION_REFRESH: {
    key: 'RECONCILIATION_REFRESH',
    method: 'POST',
    template: '/api/v1/telemetry/reconciliation/refresh',
    buildPath: () => '/api/v1/telemetry/reconciliation/refresh',
  },
  OEE_SHIFT_SUMMARY: {
    key: 'OEE_SHIFT_SUMMARY',
    method: 'GET',
    template: '/api/v1/oee/shift-summary',
    buildPath: () => '/api/v1/oee/shift-summary',
  },
  OEE_HOURLY: {
    key: 'OEE_HOURLY',
    method: 'GET',
    template: '/api/v1/oee/hourly',
    buildPath: () => '/api/v1/oee/hourly',
  },
  OEE_SHIFT_TIMELINE: {
    key: 'OEE_SHIFT_TIMELINE',
    method: 'GET',
    template: '/api/v1/oee/shift-timeline',
    buildPath: () => '/api/v1/oee/shift-timeline',
  },
  QUALITY_REJECTS_GLOBAL: {
    key: 'QUALITY_REJECTS_GLOBAL',
    method: 'GET',
    template: '/api/v1/quality/rejects',
    buildPath: () => '/api/v1/quality/rejects',
  },
  QUALITY_REJECTS_BY_DEVICE: {
    key: 'QUALITY_REJECTS_BY_DEVICE',
    method: 'GET',
    template: '/api/v1/quality/rejects/:device_id',
    buildPath: (deviceId: string) => `/api/v1/quality/rejects/${enc(deviceId)}`,
  },

  // Access Control (IAM) — 18 authoritative routes
  IAM_INFO: {
    key: 'IAM_INFO',
    method: 'GET',
    template: '/api/v1/access-control/info',
    buildPath: () => '/api/v1/access-control/info',
  },
  IAM_ROLES_LIST: {
    key: 'IAM_ROLES_LIST',
    method: 'GET',
    template: '/api/v1/access-control/roles',
    buildPath: () => '/api/v1/access-control/roles',
  },
  IAM_ROLES_CREATE: {
    key: 'IAM_ROLES_CREATE',
    method: 'POST',
    template: '/api/v1/access-control/roles',
    buildPath: () => '/api/v1/access-control/roles',
  },
  IAM_ROLES_UPDATE: {
    key: 'IAM_ROLES_UPDATE',
    method: 'PUT',
    template: '/api/v1/access-control/roles/:id',
    buildPath: (id: string) => `/api/v1/access-control/roles/${enc(id)}`,
  },
  IAM_ROLES_DELETE: {
    key: 'IAM_ROLES_DELETE',
    method: 'DELETE',
    template: '/api/v1/access-control/roles/:id',
    buildPath: (id: string) => `/api/v1/access-control/roles/${enc(id)}`,
  },
  IAM_ROLE_PERMISSIONS_ADD: {
    key: 'IAM_ROLE_PERMISSIONS_ADD',
    method: 'POST',
    template: '/api/v1/access-control/roles/:id/permissions',
    buildPath: (id: string) => `/api/v1/access-control/roles/${enc(id)}/permissions`,
  },
  IAM_ROLE_PERMISSIONS_DELETE: {
    key: 'IAM_ROLE_PERMISSIONS_DELETE',
    method: 'DELETE',
    template: '/api/v1/access-control/roles/:id/permissions/:permissionId',
    buildPath: (id: string, permissionId: string) =>
      `/api/v1/access-control/roles/${enc(id)}/permissions/${enc(permissionId)}`,
  },
  IAM_PERMISSIONS_LIST: {
    key: 'IAM_PERMISSIONS_LIST',
    method: 'GET',
    template: '/api/v1/access-control/permissions',
    buildPath: () => '/api/v1/access-control/permissions',
  },
  IAM_PERMISSIONS_CREATE: {
    key: 'IAM_PERMISSIONS_CREATE',
    method: 'POST',
    template: '/api/v1/access-control/permissions',
    buildPath: () => '/api/v1/access-control/permissions',
  },
  IAM_USER_ROLES_LIST: {
    key: 'IAM_USER_ROLES_LIST',
    method: 'GET',
    template: '/api/v1/access-control/user-roles',
    buildPath: () => '/api/v1/access-control/user-roles',
  },
  IAM_USER_ROLES_CREATE: {
    key: 'IAM_USER_ROLES_CREATE',
    method: 'POST',
    template: '/api/v1/access-control/user-roles',
    buildPath: () => '/api/v1/access-control/user-roles',
  },
  IAM_USER_ROLES_DELETE: {
    key: 'IAM_USER_ROLES_DELETE',
    method: 'DELETE',
    template: '/api/v1/access-control/user-roles',
    buildPath: () => '/api/v1/access-control/user-roles',
  },
  IAM_POLICIES_LIST: {
    key: 'IAM_POLICIES_LIST',
    method: 'GET',
    template: '/api/v1/access-control/policies',
    buildPath: () => '/api/v1/access-control/policies',
  },
  IAM_POLICIES_CREATE: {
    key: 'IAM_POLICIES_CREATE',
    method: 'POST',
    template: '/api/v1/access-control/policies',
    buildPath: () => '/api/v1/access-control/policies',
  },
  IAM_POLICIES_UPDATE: {
    key: 'IAM_POLICIES_UPDATE',
    method: 'PUT',
    template: '/api/v1/access-control/policies/:id',
    buildPath: (id: string) => `/api/v1/access-control/policies/${enc(id)}`,
  },
  IAM_POLICIES_DELETE: {
    key: 'IAM_POLICIES_DELETE',
    method: 'DELETE',
    template: '/api/v1/access-control/policies/:id',
    buildPath: (id: string) => `/api/v1/access-control/policies/${enc(id)}`,
  },
  IAM_SUBJECT_EFFECTIVE_PERMISSIONS: {
    key: 'IAM_SUBJECT_EFFECTIVE_PERMISSIONS',
    method: 'GET',
    template: '/api/v1/access-control/subjects/:operatorId/effective-permissions',
    buildPath: (operatorId: string) =>
      `/api/v1/access-control/subjects/${enc(operatorId)}/effective-permissions`,
  },
  IAM_AUDIT: {
    key: 'IAM_AUDIT',
    method: 'GET',
    template: '/api/v1/access-control/audit',
    buildPath: () => '/api/v1/access-control/audit',
  },

  // MQTT Overview (1 op)
  MQTT_OVERVIEW: {
    key: 'MQTT_OVERVIEW',
    method: 'GET',
    template: '/api/v1/mqtt/overview',
    buildPath: () => '/api/v1/mqtt/overview',
  },

  // MQTT Dynamic Security (23 ops — NO /provision route)
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

  // MQTT Configuration Manager (13 canonical operations)
  MQTT_CONFIG_GET: {
    key: 'MQTT_CONFIG_GET',
    method: 'GET',
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
} as const satisfies Record<string, EndpointDefinition>;

export type AdminEndpointKey = keyof typeof ADMIN_ENDPOINTS;

export const FORBIDDEN_ENDPOINT_PATTERNS = [
  '/mqtt/configuration/versions',
  '/mqtt/dynamic-security/clients/provision',
  '/mqtt/dynamic-security/provision',
  '/auth/operator-pin',
  '/command',
  '/work-orders/validate-zone',
  '/work-orders/initiate-from-zones',
  '/dispatch',
  '/complete',
  '/access-control/assignments',
  '/downtime/export',
] as const;

export function isValidEndpointPrefix(path: string): boolean {
  const cleanPath = path.split('?')[0];
  if (cleanPath === '/health' || cleanPath === '/ws/telemetry') {
    return true;
  }
  return cleanPath.startsWith('/api/v1/');
}
