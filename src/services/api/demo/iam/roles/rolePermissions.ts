/**
 * Method demo — domain IAM: role ↔ permission: pasang / lepas.
 *
 * Dipisah dari demo/iam/roles.ts (482 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../roles.ts).
 */
import { store } from '../../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { ApiError } from '../../../../../types/auth';
import { isReservedPermission } from '../../../../../utils/capabilities';

export const demoIamRolesRolePermissions = {
  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: {
      resourcePattern?: string;
      effect?: 'ALLOW' | 'DENY';
      abacCondition?: Record<string, unknown> | null;
    }
  ): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLE_PERMISSIONS_ADD', ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_ADD.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    const perm = store.iamPermissions.find((p) => p.id === permissionId);
    if (!role || !perm) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role atau permission tidak ditemukan.', httpStatus: 404 });
    }
    const effect = options?.effect ?? 'ALLOW';
    if (role.name === 'ADMIN' && effect === 'DENY') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    if (!role.is_system && isReservedPermission(perm.action, perm.resourceType)) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${perm.action}:${perm.resourceType}" adalah reserved permission yang tidak boleh di-assign ke custom role.`,
        httpStatus: 403,
      });
    }
    const resourcePattern = options?.resourcePattern?.trim() || `${perm.resourceType}:*`;
    if (resourcePattern.length < 1 || resourcePattern.length > 128) {
      throwValidationIssues('Resource pattern wajib 1–128 karakter.', {
        resourcePattern: 'Panjang 1–128 karakter.',
      });
    }
    if (!role.is_system && effect === 'ALLOW' && (resourcePattern === '*' || resourcePattern === 'org:*')) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Custom role tidak boleh diberikan wildcard resource pattern (*).',
        httpStatus: 403,
      });
    }
    const duplicate = store.iamPolicies.some(
      (p) =>
        p.roleId === role.id &&
        p.permissionId === perm.id &&
        p.resourcePattern === resourcePattern &&
        p.effect === effect
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_ROLE_PERMISSION',
        message: `Permission "${perm.action}:${perm.resourceType}" (${effect} · ${resourcePattern}) sudah terpasang pada role "${role.name}".`,
        httpStatus: 409,
      });
    }
    store.iamPolicies.push({
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      roleId: role.id,
      roleName: role.name,
      subjectMatch: `role:${role.name}`,
      permissionId: perm.id,
      action: perm.action,
      resourceType: perm.resourceType,
      resourcePattern,
      effect,
      abacCondition: options?.abacCondition ?? null,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ADD_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Assigned ${effect} ${perm.action}:${perm.resourceType} (${resourcePattern}) to ${role.name}`
    );
    return { success: true };
  },

  async removeIamRolePermission(roleId: string, permissionId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint(
      'IAM_ROLE_PERMISSIONS_DELETE',
      ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_DELETE.buildPath(roleId, permissionId)
    );
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menghapus permission dari role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    const existingCount = store.iamPolicies.filter(
      (p) => p.roleId === roleId && p.permissionId === permissionId
    ).length;
    if (existingCount === 0) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Ikatan permission pada role tersebut tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamPolicies = store.iamPolicies.filter(
      (p) => !(p.roleId === roleId && p.permissionId === permissionId)
    );
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REMOVE_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Revoked permission ${permissionId} from role ${role.name}`
    );
    return { success: true };
  }
};
