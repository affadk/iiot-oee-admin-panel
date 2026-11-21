/**
 * Registry endpoint — domain devices.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const DEVICE_ENDPOINTS: Record<string, EndpointDefinition> = {
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

  // §E.3a (spec 015, ADR-009) — pengganti kanonis K-11 untuk provisioning perangkat.
  DEVICES_PROVISION: {
    key: 'DEVICES_PROVISION',
    method: 'POST',
    template: '/api/v1/devices/provision',
    buildPath: () => '/api/v1/devices/provision',
  },

  // §E.3b — cabut kredensial; selalu diizinkan termasuk saat WO ACTIVE.
  DEVICES_REVOKE: {
    key: 'DEVICES_REVOKE',
    method: 'POST',
    template: '/api/v1/devices/:deviceId/revoke',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}/revoke`,
  },

  // §E.3c — rotasi kredensial; guard 409 DEVICE_IN_PRODUCTION tanpa force.
  DEVICES_CREDENTIALS: {
    key: 'DEVICES_CREDENTIALS',
    method: 'POST',
    template: '/api/v1/devices/:deviceId/credentials',
    buildPath: (id: string) => `/api/v1/devices/${enc(id)}/credentials`,
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
};
