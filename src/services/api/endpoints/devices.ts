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
