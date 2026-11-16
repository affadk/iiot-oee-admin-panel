/**
 * Registry endpoint — domain machines.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const MACHINE_ENDPOINTS: Record<string, EndpointDefinition> = {
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
};
