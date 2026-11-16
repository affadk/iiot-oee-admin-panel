/**
 * Registry endpoint — domain auth.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';

export const AUTH_ENDPOINTS: Record<string, EndpointDefinition> = {
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
};
