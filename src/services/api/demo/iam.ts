/**
 * Method demo — domain iam.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Operator } from '../../../types/production';
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../../types/iam';
import { ApiError } from '../../../types/auth';
import { CUSTOM_ROLE_MAX_LEVEL, VALIDATION_PATTERNS, isReservedPermission, isSystemRoleName, policyMatchesRole, policyTargetsAdmin } from '../../../utils/capabilities';
import { IamAssignmentSchema, IamPermissionSchema, IamPolicyRuleSchema, IamRoleSchema } from '../schemas';

export const demoIam = {
  // =========================================================================
  // ACCESS CONTROL / IAM (18 Authoritative Operations — ADMIN + LAN ONLY)
  // =========================================================================
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_INFO', ADMIN_ENDPOINTS.IAM_INFO.buildPath());
    return { ...store.iamInfo };
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_ROLES_LIST', ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath());
    return store.iamRoles.map((r) =>
      IamRoleSchema.parse({
        ...r,
        policy_count: store.iamPolicies.filter((p) => p.role_id === r.id || p.role === r.name).length,
      })
    );
  },

  async createIamRole(data: { name: string; privilege_level: number; description: string }): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN']);
    const trimmedName = data.name.trim();
    const trimmedDesc = data.description.trim();
    const fieldErrors: Record<string, string> = {};

    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      fieldErrors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    if (!Number.isInteger(data.privilege_level) || data.privilege_level > CUSTOM_ROLE_MAX_LEVEL || data.privilege_level < 1) {
      fieldErrors.privilege_level = `Level custom role wajib bilangan bulat 1–${CUSTOM_ROLE_MAX_LEVEL}.`;
    }
    if (trimmedDesc.length < 3 || trimmedDesc.length > 256) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembuatan custom role gagal.', fieldErrors);
    }

    store.recordEndpoint('IAM_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath());
    if (isSystemRoleName(trimmedName)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: `Nama "${trimmedName}" adalah role sistem yang dilindungi.`,
        httpStatus: 403,
      });
    }
    if (store.iamRoles.some((r) => r.name.toUpperCase() === trimmedName.toUpperCase())) {
      throw new ApiError({ code: 'CONFLICT', message: `Role "${trimmedName}" sudah ada.`, httpStatus: 409 });
    }

    const newRole: IamRole = IamRoleSchema.parse({
      id: `role-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      name: trimmedName,
      privilege_level: data.privilege_level,
      is_system: false,
      description: trimmedDesc,
      created_at: new Date().toISOString(),
    });
    store.iamRoles.push(newRole);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_ROLE', 'IAM', newRole.id, `Created custom IAM role ${newRole.name} (level ${newRole.privilege_level})`);
    return { ...newRole, policy_count: 0 };
  },

  async updateIamRole(
    roleId: string,
    patch: { description?: string; privilege_level?: number }
  ): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_UPDATE', ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isSystemRoleName(role.name)) {
      throw new ApiError({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: `Role sistem (${role.name}) dilindungi dan tidak dapat diubah atau dihapus.`,
        httpStatus: 403,
      });
    }
    const fieldErrors: Record<string, string> = {};
    if (patch.privilege_level !== undefined && (!Number.isInteger(patch.privilege_level) || patch.privilege_level > CUSTOM_ROLE_MAX_LEVEL || patch.privilege_level < 1)) {
      fieldErrors.privilege_level = `Level custom role maksimal ${CUSTOM_ROLE_MAX_LEVEL} (1–29).`;
    }
    if (patch.description !== undefined && (patch.description.trim().length < 3 || patch.description.trim().length > 256)) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembaruan role gagal.', fieldErrors);
    }
    if (patch.description !== undefined) role.description = patch.description.trim();
    if (patch.privilege_level !== undefined) role.privilege_level = patch.privilege_level;
    store.addAudit('UPDATE_ROLE', 'IAM', roleId, `Updated IAM role ${role.name}`);
    return IamRoleSchema.parse({ ...role });
  },

  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isSystemRoleName(role.name)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Role sistem (ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE) dilindungi.',
        httpStatus: 403,
      });
    }
    const activeAssignments = store.iamAssignments.filter(
      (a) => a.role_id === roleId || a.role_name === role.name
    );
    if (activeAssignments.length > 0) {
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih digunakan oleh ${activeAssignments.length} penugasan operator. Cabut penugasan user terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    store.iamRoles = store.iamRoles.filter((r) => r.id !== roleId);
    // Clean up orphaned policy bindings for this unused custom role
    store.iamPolicies = store.iamPolicies.filter((p) => p.role_id !== roleId && p.role !== role.name);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_ROLE', 'IAM', roleId, `Deleted custom IAM role ${role.name}`);
    return { success: true };
  },

  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: {
      resourcePattern?: string;
      effect?: 'ALLOW' | 'DENY';
      abacCondition?: Record<string, unknown> | null;
      reason?: string;
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
    if (!role.is_system && isReservedPermission(perm.action, perm.resource_type)) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${perm.action}:${perm.resource_type}" adalah reserved permission yang tidak boleh di-assign ke custom role.`,
        httpStatus: 403,
      });
    }
    const resourcePattern = options?.resourcePattern?.trim() || `${perm.resource_type}:*`;
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
        (p.role_id === role.id || p.role === role.name) &&
        p.permission_id === perm.id &&
        p.resource_pattern === resourcePattern &&
        p.eft === effect
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_ROLE_PERMISSION',
        message: `Permission "${perm.action}:${perm.resource_type}" (${effect} · ${resourcePattern}) sudah terpasang pada role "${role.name}".`,
        httpStatus: 409,
      });
    }
    store.iamPolicies.push({
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      role: role.name,
      role_id: role.id,
      permission_id: perm.id,
      action: perm.action,
      resource_pattern: resourcePattern,
      eft: effect,
      abac_condition: options?.abacCondition ?? null,
      is_active: true,
      reason: options?.reason?.trim() || `Role permission binding ${perm.action}:${perm.resource_type}`,
    });
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ADD_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Assigned ${effect} ${perm.action}:${perm.resource_type} (${resourcePattern}) to ${role.name}`
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
      (p) => p.role_id === roleId && p.permission_id === permissionId
    ).length;
    if (existingCount === 0) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Ikatan permission pada role tersebut tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamPolicies = store.iamPolicies.filter(
      (p) => !(p.role_id === roleId && p.permission_id === permissionId)
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
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_LIST', ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath());
    return store.iamPermissions.map((p) => IamPermissionSchema.parse({ ...p }));
  },

  async createIamPermission(_data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_CREATE', ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath());
    throw new ApiError({
      code: 'PERMISSION_CATALOG_READ_ONLY',
      message: 'Permission Catalog bersifat master data tetap (read-only) dan tidak boleh dibuat, diubah, atau dihapus.',
      httpStatus: 403,
    });
  },

  async getIamUserRoles(signal?: AbortSignal): Promise<IamAssignment[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_USER_ROLES_LIST', ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath());
    return store.iamAssignments.map((a) => IamAssignmentSchema.parse({ ...a }));
  },

  async assignIamUserRole(data: {
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<IamAssignment> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: data.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_USER_ROLES_CREATE.buildPath());
    const op = store.operators.find((o) => o.operator_id === data.operatorId);
    const role = store.iamRoles.find((r) => r.name === data.roleName);
    if (!op || !role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Operator atau Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN' && store.currentUserRole !== 'ADMIN') {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Hanya ADMIN yang dapat memberikan penugasan role ADMIN.',
        httpStatus: 403,
      });
    }
    if (data.scopeType !== 'ORGANIZATION' && !data.scopeId?.trim()) {
      throwValidationIssues('scopeId wajib diisi untuk scope selain ORGANIZATION.', {
        scopeId: 'Scope ID wajib diisi.',
      });
    }
    const normalizedScopeId = data.scopeType === 'ORGANIZATION' ? null : (data.scopeId?.trim() ?? null);
    if (normalizedScopeId && normalizedScopeId.length > 64) {
      throwValidationIssues('Scope ID maksimal 64 karakter.', { scopeId: 'Maksimal 64 karakter.' });
    }
    const duplicate = store.iamAssignments.some(
      (a) =>
        a.operator_id === op.operator_id &&
        a.role_name === role.name &&
        a.scope_type === data.scopeType &&
        (a.scope_id ?? null) === normalizedScopeId
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_USER_ROLE',
        message: `Operator ${op.operator_id} sudah memiliki penugasan role ${role.name} pada scope ${data.scopeType}${normalizedScopeId ? ` (${normalizedScopeId})` : ''}.`,
        httpStatus: 409,
      });
    }

    const newAsg: IamAssignment = IamAssignmentSchema.parse({
      id: `asg-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      operator_id: op.operator_id,
      operator_name: op.name,
      role_id: role.id,
      role_name: role.name,
      scope_type: data.scopeType,
      scope_id: normalizedScopeId,
      created_at: new Date().toISOString(),
    });
    store.iamAssignments.push(newAsg);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ASSIGN_USER_ROLE',
      'IAM',
      newAsg.id,
      `Assigned ${newAsg.role_name} to ${newAsg.operator_id} (${newAsg.scope_type})`
    );
    return { ...newAsg };
  },

  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: assignment.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_USER_ROLES_DELETE.buildPath());
    const targetOp = store.operators.find((o) => o.operator_id === assignment.operatorId);
    if ((targetOp?.is_protected || assignment.operatorId === 'ADM-001') && assignment.roleName === 'ADMIN') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: 'Anti-Lockout Guard: Role ADMIN pada ADM-001 tidak dapat dicabut.',
        httpStatus: 403,
      });
    }
    const matchesTarget = (a: IamAssignment) => {
      if (assignment.id && a.id === assignment.id) return true;
      return (
        a.operator_id === assignment.operatorId &&
        a.role_name === assignment.roleName &&
        a.scope_type === assignment.scopeType &&
        (a.scope_id ?? null) === (assignment.scopeId ?? null)
      );
    };
    const found = store.iamAssignments.some(matchesTarget);
    if (!found) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Penugasan role operator tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamAssignments = store.iamAssignments.filter((a) => !matchesTarget(a));
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REVOKE_USER_ROLE',
      'IAM',
      assignment.operatorId,
      `Revoked ${assignment.roleName} from ${assignment.operatorId}`
    );
    return { success: true };
  },

  async getIamPolicies(signal?: AbortSignal): Promise<IamPolicyRule[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_POLICIES_LIST', ADMIN_ENDPOINTS.IAM_POLICIES_LIST.buildPath());
    return store.iamPolicies.map((p) => IamPolicyRuleSchema.parse({ ...p }));
  },

  async createIamPolicy(data: Omit<IamPolicyRule, 'id'>): Promise<IamPolicyRule> {
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_POLICIES_CREATE', ADMIN_ENDPOINTS.IAM_POLICIES_CREATE.buildPath());
    if (policyTargetsAdmin(data.role) && data.eft === 'DENY') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    const roleParts = data.role.split('|').map((r) => r.trim());
    const hasCustomOrWildcardRole = roleParts.some((r) => {
      if (r === '*') return true;
      const found = store.iamRoles.find((ir) => ir.name === r);
      return found ? !found.is_system : !isSystemRoleName(r);
    });
    const resType = data.resource_pattern.split(':')[0] || '*';
    if (
      hasCustomOrWildcardRole &&
      data.eft === 'ALLOW' &&
      (isReservedPermission(data.action, resType) || data.resource_pattern.trim() === '*' || data.resource_pattern.trim() === 'org:*')
    ) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${data.action}:${resType}" adalah reserved permission yang tidak boleh diberikan melalui policy untuk custom role.`,
        httpStatus: 403,
      });
    }
    const newPol: IamPolicyRule = IamPolicyRuleSchema.parse({
      ...data,
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
    });
    store.iamPolicies.push(newPol);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_POLICY', 'IAM', newPol.id, `Created ${newPol.eft} policy for ${newPol.role}: ${newPol.action}`);
    return { ...newPol };
  },

  async updateIamPolicy(
    policyId: string,
    patch: Partial<Pick<IamPolicyRule, 'eft' | 'action' | 'resource_pattern' | 'abac_condition' | 'is_active' | 'reason'>>
  ): Promise<IamPolicyRule> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: policyId });
    store.recordEndpoint('IAM_POLICIES_UPDATE', ADMIN_ENDPOINTS.IAM_POLICIES_UPDATE.buildPath(policyId));
    const pol = store.iamPolicies.find((p) => p.id === policyId);
    if (!pol) throw new ApiError({ code: 'NOT_FOUND', message: 'Policy tidak ditemukan.', httpStatus: 404 });
    if (policyTargetsAdmin(pol.role) && (patch.is_active === false || patch.eft === 'DENY')) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menonaktifkan atau mengubah policy ADMIN menjadi DENY dilarang.',
        httpStatus: 403,
      });
    }
    const nextAction = patch.action ?? pol.action;
    const nextResource = patch.resource_pattern ?? pol.resource_pattern;
    const nextEft = patch.eft ?? pol.eft;
    const roleParts = pol.role.split('|').map((r) => r.trim());
    const hasCustomOrWildcardRole = roleParts.some((r) => {
      if (r === '*') return true;
      const found = store.iamRoles.find((ir) => ir.name === r);
      return found ? !found.is_system : !isSystemRoleName(r);
    });
    const resType = nextResource.split(':')[0] || '*';
    if (
      hasCustomOrWildcardRole &&
      nextEft === 'ALLOW' &&
      (isReservedPermission(nextAction, resType) || nextResource.trim() === '*' || nextResource.trim() === 'org:*')
    ) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${nextAction}:${resType}" adalah reserved permission untuk sistem dan dilarang pada custom role.`,
        httpStatus: 403,
      });
    }
    Object.assign(pol, patch);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('UPDATE_POLICY', 'IAM', policyId, `Updated policy ${policyId}`);
    return IamPolicyRuleSchema.parse({ ...pol });
  },

  async toggleIamPolicy(policyId: string, isActive: boolean): Promise<IamPolicyRule> {
    return demoIam.updateIamPolicy(policyId, { is_active: isActive });
  },

  async deleteIamPolicy(policyId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: policyId });
    store.recordEndpoint('IAM_POLICIES_DELETE', ADMIN_ENDPOINTS.IAM_POLICIES_DELETE.buildPath(policyId));
    const pol = store.iamPolicies.find((p) => p.id === policyId);
    if (!pol) throw new ApiError({ code: 'NOT_FOUND', message: 'Policy tidak ditemukan.', httpStatus: 404 });
    if (policyTargetsAdmin(pol.role)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menghapus policy ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    store.iamPolicies = store.iamPolicies.filter((p) => p.id !== policyId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_POLICY', 'IAM', policyId, `Deleted policy ${policyId}`);
    return { success: true };
  },

  async getSubjectEffectivePermissions(
    operatorId: string,
    signal?: AbortSignal
  ): Promise<IamEffectivePermissions> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint(
      'IAM_SUBJECT_EFFECTIVE_PERMISSIONS',
      ADMIN_ENDPOINTS.IAM_SUBJECT_EFFECTIVE_PERMISSIONS.buildPath(operatorId)
    );
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    const assignments = store.iamAssignments.filter((a) => a.operator_id === operatorId);
    const roleNames = Array.from(new Set([op.role, ...assignments.map((a) => a.role_name)]));
    const matchingPolicies = store.iamPolicies.filter((p) => p.is_active && policyMatchesRole(p.role, roleNames));

    return {
      operatorId: op.operator_id,
      primaryRole: op.role,
      effectiveRoles:
        assignments.length > 0
          ? assignments.map((a) => ({
              roleName: a.role_name,
              scopeType: a.scope_type,
              scopeId: a.scope_id,
            }))
          : [{ roleName: op.role, scopeType: 'ORGANIZATION', scopeId: null }],
      permissions: matchingPolicies.map((p) => ({
        action: p.action,
        resourceType: p.resource_pattern.split(':')[0] || '*',
        resourcePattern: p.resource_pattern,
        effect: p.eft,
        sourceRole: p.role,
        abacCondition:
          typeof p.abac_condition === 'string'
            ? (() => {
                try {
                  return JSON.parse(p.abac_condition);
                } catch {
                  return { raw: p.abac_condition };
                }
              })()
            : p.abac_condition ?? null,
      })),
    };
  },

  async getIamAuditDecisions(limit = 100, signal?: AbortSignal): Promise<IamAuditDecision[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_AUDIT', `${ADMIN_ENDPOINTS.IAM_AUDIT.buildPath()}?limit=${limit}`);
    return store.iamAuditDecisions.slice(0, Math.min(1000, limit)).map((d) => ({ ...d }));
  }
};
