/**
 * Registry endpoint — domain iam.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const IAM_ENDPOINTS: Record<string, EndpointDefinition> = {
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
};
