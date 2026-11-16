/**
 * Registry endpoint — domain operators.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const OPERATOR_ENDPOINTS: Record<string, EndpointDefinition> = {
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
};
